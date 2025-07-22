const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Envía un email con HTML.
 * @param {string[]} to  lista de destinatarios.
 * @param {string} subject
 * @param {string} html
 */
async function sendMail({ to, subject, html }) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: to.join(','),
    subject,
    html
  });
}

module.exports = { sendMail };