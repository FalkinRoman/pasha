import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT', 587)),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
    }
  }

  get configured() {
    return Boolean(this.transporter);
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    const from = this.config.get('SMTP_FROM', 'stopkek <noreply@stopkek.ru>');
    const subject = 'Восстановление пароля — stopkek Admin';
    const text = [
      'Запрошено восстановление пароля для панели администратора stopkek.',
      '',
      `Перейдите по ссылке (действует 1 час):`,
      resetUrl,
      '',
      'Если вы не запрашивали сброс — проигнорируйте письмо.',
    ].join('\n');

    const html = `
      <div style="font-family:Inter,sans-serif;background:#0a0a0a;color:#fff;padding:24px">
        <h2 style="color:#c41e24">stopkek Admin</h2>
        <p>Восстановление пароля</p>
        <p><a href="${resetUrl}" style="color:#e53935">Сбросить пароль</a></p>
        <p style="color:#9e9e9e;font-size:12px">Ссылка действует 1 час. Если это не вы — удалите письмо.</p>
      </div>
    `;

    if (!this.transporter) {
      this.logger.warn(`[MAIL DEV] To: ${to}\n${text}`);
      return { dev: true, resetUrl };
    }

    await this.transporter.sendMail({ from, to, subject, text, html });
    return { dev: false };
  }
}
