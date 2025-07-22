const nodemailer = require('nodemailer');

// 1) Crea el transporter con logging y debug activados
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,               // e.g. smtp.gmail.com
  port:   Number(process.env.SMTP_PORT),       // 587 o 465
  secure: process.env.SMTP_PORT === '465',     // true si usas 465
  auth: {
    user: process.env.SMTP_USER,               // tu cuenta Gmail o SMTP
    pass: process.env.SMTP_PASS                // tu App Password de 16 caracteres
  },
  logger: true,   // habilita logs de nodemailer
  debug:  true    // imprime protocolo SMTP
});

// 2) Verifica la conexión al arrancar
transporter.verify((err, success) => {
  if (err) {
    console.error('❌ SMTP connection error:', err);
  } else {
    console.log('✅ SMTP conectado correctamente');
  }
});

/**
 * Envía un email con HTML.
 * @param {Object}   opts
 * @param {string[]|string} opts.to       Lista de destinatarios o un string
 * @param {string}         opts.subject  Asunto del correo
 * @param {string}         opts.html     Contenido HTML
 */
async function sendMail({ to, subject, html }) {
  // 3) Si no recibimos destinatarios, enviamos al propio SMTP_USER
  let recipients = [];
  if (Array.isArray(to)) {
    recipients = to.length ? to : [process.env.SMTP_USER];
  } else if (typeof to === 'string' && to.trim()) {
    recipients = [to];
  } else {
    recipients = [process.env.SMTP_USER];
  }

  const info = await transporter.sendMail({
    from:    process.env.SMTP_USER,
    to:      recipients.join(','),
    subject,
    html
  });

  console.log('✉️  Mensaje enviado, ID:', info.messageId);
}

module.exports = { sendMail };