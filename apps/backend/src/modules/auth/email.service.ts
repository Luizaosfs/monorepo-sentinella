import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from 'src/lib/env/server';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private transporter() {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? 587),
      secure: Number(env.SMTP_PORT ?? 587) === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    if (!env.SMTP_HOST) {
      this.logger.warn('[EmailService] SMTP não configurado — reset solicitado mas email não enviado');
      return;
    }

    const from = env.SMTP_FROM ?? 'noreply@sentinellaweb.com.br';

    try {
      await this.transporter().sendMail({
        from: `"Sentinella Web" <${from}>`,
        to,
        subject: 'Redefinição de senha — Sentinella Web',
        html: `
          <p>Olá,</p>
          <p>Você solicitou a redefinição de senha da sua conta no <strong>Sentinella Web</strong>.</p>
          <p>
            <a href="${resetUrl}" style="
              display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;
              border-radius:6px;text-decoration:none;font-weight:bold;
            ">Redefinir senha</a>
          </p>
          <p>Este link expira em <strong>1 hora</strong>.</p>
          <p>Se você não solicitou isso, ignore este email.</p>
          <hr/>
          <p style="font-size:12px;color:#6b7280;">Sentinella Web — Vigilância Entomológica Municipal</p>
        `,
      });
    } catch (err: any) {
      const maskedEmail = `${to.substring(0, 3)}***@${to.split('@')[1] ?? '***'}`;
      this.logger.error(`[EmailService] Falha ao enviar email para ${maskedEmail}: ${err?.message}`);
    }
  }
}
