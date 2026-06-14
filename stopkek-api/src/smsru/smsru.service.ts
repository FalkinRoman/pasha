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
      const retry = await this.doSend(phoneDigits, code, undefined, false);
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

/** SMS.ru иногда отдаёт code числом (8570 вместо "8570") */
export function normalizeCallCode(code: string | number): string {
  const digits = String(code).replace(/\D/g, '');
  return digits.slice(-4).padStart(4, '0');
}
