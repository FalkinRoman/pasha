import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SmscSendResponse = {
  id?: number;
  cnt?: number;
  cost?: string;
  balance?: string;
  error?: string;
  error_code?: number;
};

@Injectable()
export class SmscService {
  private readonly logger = new Logger(SmscService.name);
  private readonly login: string;
  private readonly password: string;
  private readonly sender: string;

  constructor(private readonly config: ConfigService) {
    this.login = this.config.get<string>('SMSC_LOGIN', '').trim();
    this.password = this.config.get<string>('SMSC_PASSWORD', '').trim();
    // Пусто = отправка без буквенного sender (до регистрации имени в ЛК smsc.ru)
    this.sender = this.config.get<string>('SMSC_SENDER', '').trim();
  }

  get enabled() {
    return Boolean(this.login && this.password);
  }

  private mapError(raw: string, errorCode?: number): string {
    const msg = raw.toLowerCase();
    if (msg.includes('denied') || errorCode === 6) {
      return 'SMSC отклонил SMS (код 6). Напишите в support@smsc.ru: включите сервисные SMS на все номера, текст «Код: 1234». Или войдите по звонку.';
    }
    if (msg.includes('authorise') || msg.includes('authorize') || errorCode === 2) {
      return 'Неверный логин или пароль SMSC.ru (SMSC_LOGIN / SMSC_PASSWORD в .env).';
    }
    if (msg.includes('no money') || errorCode === 3) {
      return 'Недостаточно средств на балансе SMSC.ru.';
    }
    return raw;
  }

  /** https://smsc.ru/api/http/send/sms/ */
  async sendOtp(phoneDigits: string, code: string) {
    const mes = `Код: ${code}`;
    const url = new URL('https://smsc.ru/sys/send.php');
    url.searchParams.set('login', this.login);
    url.searchParams.set('psw', this.password);
    url.searchParams.set('phones', phoneDigits);
    url.searchParams.set('mes', mes);
    url.searchParams.set('charset', 'utf-8');
    url.searchParams.set('fmt', '3');
    if (this.sender) {
      url.searchParams.set('sender', this.sender);
    }

    const res = await fetch(url.toString());
    const data = (await res.json()) as SmscSendResponse;
    if (data.error) {
      this.logger.warn(`smsc send failed: ${JSON.stringify(data)}`);
      throw new BadGatewayException(this.mapError(data.error, data.error_code));
    }
    this.logger.log(
      `smsc send OK phone=${phoneDigits} id=${data.id} cost=${data.cost} balance=${data.balance}`
    );
    return { ok: true, id: data.id };
  }
}
