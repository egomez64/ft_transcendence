const nodemailer = require('nodemailer');

// Transport SMTP si dispo, sinon transport "console" (affiche l’email dans les logs)
function buildTransport() {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
    if (SMTP_HOST && SMTP_PORT) {
        return nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT),
            secure: String(SMTP_SECURE || 'false') === 'true',
            auth: (SMTP_USER && SMTP_PASS) ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
        });
    }
  // Fallback: n’envoie pas vraiment d’emails, mais imprime le contenu (pratique en dev)
    return nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
    });
}

const transport = buildTransport();
const FROM = process.env.SMTP_FROM || 'no-reply@transcendance.com';

async function sendMail({ to, subject, text, html }) {
  const info = await transport.sendMail({ from: FROM, to, subject, text, html });
  if (info.message)
    console.log('=== MAIL (dev/console transport) ===\n' + info.message.toString());
  return info;
}

module.exports = { sendMail };