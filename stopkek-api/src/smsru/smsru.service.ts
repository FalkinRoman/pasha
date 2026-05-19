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

@Injectable()
export class SmsRuService {
  private readonly logger = new Logger(SmsRuService.name);
  private readonly apiId: string;

  constructor(private readonly config: ConfigService) {
    this.apiId = this.config.get<string>('SMSRU_API_ID', '');
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
}

/** SMS.ru иногда отдаёт code числом (8570 вместо "8570") */
export function normalizeCallCode(code: string | number): string {
  const digits = String(code).replace(/\D/g, '');
  return digits.slice(-4).padStart(4, '0');
}
