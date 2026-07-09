import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CodeCallResponse = {
  status: string;
  status_code?: number;
  code?: string | number;
  call_id?: string;
  cost?: number;
  balance?: number;
  status_text?: string;
};

type CallcheckAddResponse = {
  status: string;
  status_code?: number;
  check_id?: string;
  call_phone?: string;
  call_phone_pretty?: string;
  call_phone_html?: string;
  status_text?: string;
};

type CallcheckStatusResponse = {
  status: string;
  status_code?: number;
  check_status?: string | number;
  check_status_text?: string;
  status_text?: string;
};

export type CallcheckStatus = 'pending' | 'confirmed' | 'expired';

type SmsSendResponse = {
  status: string;
  status_code?: number;
  status_text?: string;
  balance?: number;
  sms?: Record<
    string,
    { status: string; status_code?: number; sms_id?: string; status_text?: string }
  >;
};

@Injectable()
export class SmsRuService {
  private readonly logger = new Logger(SmsRuService.name);
  private readonly apiId: string;
  private readonly senderId: string;

  constructor(private readonly config: ConfigService) {
    this.apiId = this.config.get<string>('SMSRU_API_ID', '');
    this.senderId = this.config.get<string>('SMSRU_SENDER_ID', '');
  }

  get enabled() {
    return Boolean(this.apiId);
  }

  /**
   * Входящий звонок пользователю; code — последние 4 цифры номера звонящего.
   * https://sms.ru/api/code_call
   */
  async codeCall(phoneDigits: string, clientIp: string) {
    const url = new URL('https://sms.ru/code/call');
    url.searchParams.set('api_id', this.apiId);
    url.searchParams.set('phone', phoneDigits);
    url.searchParams.set('ip', clientIp);
    url.searchParams.set('json', '1');

    const res = await fetch(url.toString());
    const data = (await res.json()) as CodeCallResponse;
    if (data.status !== 'OK' || !data.code || !data.call_id) {
      this.logger.warn(`code/call failed: ${JSON.stringify(data)}`);
      throw new BadGatewayException(data.status_text ?? 'SMS.ru code/call error');
    }
    this.logger.log(
      `code/call OK phone=${phoneDigits} call_id=${data.call_id} cost=${data.cost} balance=${data.balance}`
    );
    return {
      code: normalizeCallCode(data.code),
      callId: String(data.call_id),
    };
  }

  /**
   * Пользователь звонит на выданный номер; мы ждём входящий с его phone.
   * https://sms.ru/api/call (callcheck/add)
   */
  async callcheckAdd(phoneDigits: string) {
    const url = new URL('https://sms.ru/callcheck/add');
    url.searchParams.set('api_id', this.apiId);
    url.searchParams.set('phone', phoneDigits);
    url.searchParams.set('json', '1');

    const res = await fetch(url.toString());
    const data = (await res.json()) as CallcheckAddResponse;
    if (data.status !== 'OK' || !data.check_id || !data.call_phone) {
      this.logger.warn(`callcheck/add failed: ${JSON.stringify(data)}`);
      throw new BadGatewayException(data.status_text ?? 'SMS.ru callcheck/add error');
    }
    this.logger.log(
      `callcheck/add OK phone=${phoneDigits} check_id=${data.check_id} call_phone=${data.call_phone}`
    );
    return {
      checkId: String(data.check_id),
      callPhone: String(data.call_phone),
      callPhonePretty:
        data.call_phone_pretty?.trim() ||
        formatRuPhonePretty(String(data.call_phone)),
    };
  }

  /**
   * Статус callcheck: 400 — ждём, 401 — подтверждён, 402 — истёк.
   * https://sms.ru/api/call (callcheck/status)
   */
  async callcheckStatus(checkId: string): Promise<CallcheckStatus> {
    const url = new URL('https://sms.ru/callcheck/status');
    url.searchParams.set('api_id', this.apiId);
    url.searchParams.set('check_id', checkId);
    url.searchParams.set('json', '1');

    const res = await fetch(url.toString());
    const data = (await res.json()) as CallcheckStatusResponse;
    if (data.status !== 'OK') {
      this.logger.warn(`callcheck/status failed: ${JSON.stringify(data)}`);
      throw new BadGatewayException(data.status_text ?? 'SMS.ru callcheck/status error');
    }

    const code = String(data.check_status ?? '');
    if (code === '401') return 'confirmed';
    if (code === '402') return 'expired';
    return 'pending';
  }

  /**
   * Отправка OTP по SMS.
   * https://sms.ru/api/send
   * Если оператор не подключён к именному отправителю (status_code=213) —
   * автоматически повторяет без from (generic sender).
   */
  async sendOtp(phoneDigits: string, code: string) {
    const result = await this.doSend(phoneDigits, code, this.senderId || undefined);

    // Ищем запись в ответе по любому ключу (SMS.ru может вернуть номер в другом формате)
    const smsEntry = result.sms
      ? (result.sms[phoneDigits] ?? Object.values(result.sms)[0])
      : undefined;
    const smsCode = smsEntry?.status_code ?? result.status_code;

    // 204 — оператор не подключён к отправителю (а также запасному / по умолчанию)
    // 221 — аккаунту обязателен именной отправитель, но он не покрывает этого оператора
    if (smsCode === 204 || smsCode === 221) {
      this.logger.warn(`sms/send sender not approved for operator (${smsCode}), retrying without from`);
      const retry = await this.doSend(phoneDigits, code, undefined);
      const retrySms = retry.sms
        ? (retry.sms[phoneDigits] ?? Object.values(retry.sms)[0])
        : undefined;
      if (retry.status === 'OK' && retrySms?.status === 'OK') {
        this.logger.log(`sms/send (no-sender) OK phone=${phoneDigits} sms_id=${retrySms.sms_id}`);
        return { ok: true, smsId: retrySms.sms_id };
      }
      // Второй запрос тоже не прошёл — именной отправитель обязателен для аккаунта
      this.logger.warn(`sms/send (no-sender) also failed: ${JSON.stringify(retry)}`);
      throw new BadGatewayException('SMS временно недоступен. Используйте вход по звонку.');
    }

    if (result.status !== 'OK' || !smsEntry || smsEntry.status !== 'OK') {
      this.logger.warn(`sms/send failed: ${JSON.stringify(result)}`);
      throw new BadGatewayException(
        smsEntry?.status_text ?? result.status_text ?? 'SMS.ru sms/send error'
      );
    }
    this.logger.log(`sms/send OK phone=${phoneDigits} sms_id=${smsEntry.sms_id} balance=${result.balance}`);
    return { ok: true, smsId: smsEntry.sms_id };
  }

  private async doSend(
    phoneDigits: string,
    code: string,
    senderId?: string,
  ): Promise<SmsSendResponse> {
    const url = new URL('https://sms.ru/sms/send');
    url.searchParams.set('api_id', this.apiId);
    url.searchParams.set('to', phoneDigits);
    url.searchParams.set('msg', `Ваш код входа: ${code}`);
    url.searchParams.set('json', '1');
    if (senderId) url.searchParams.set('from', senderId);

    const res = await fetch(url.toString());
    return (await res.json()) as SmsSendResponse;
  }
}

function formatRuPhonePretty(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 11 && (d.startsWith('7') || d.startsWith('8'))) {
    const n = d.startsWith('8') ? '7' + d.slice(1) : d;
    return `+7 (${n.slice(1, 4)}) ${n.slice(4, 7)}-${n.slice(7, 9)}-${n.slice(9, 11)}`;
  }
  if (d.length === 10) {
    return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
  }
  return digits.startsWith('+') ? digits : `+${d}`;
}

/** SMS.ru иногда отдаёт code числом (8570 вместо "8570") */
export function normalizeCallCode(code: string | number): string {
  const digits = String(code).replace(/\D/g, '');
  return digits.slice(-4).padStart(4, '0');
}
