// Importo el módulo nodemailer para enviar correos
const nodemailer = require('nodemailer');

// Creo el transportador SMTP usando variables de entorno
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,                           // Especifico el host SMTP
  port: Number(process.env.SMTP_PORT),                   // Convierto el puerto a número
  secure: process.env.SMTP_PORT === '465',               // Uso TLS si el puerto es 465
  auth: {
    user: process.env.SMTP_USER,                         // Usuario SMTP
    pass: process.env.SMTP_PASS                          // Contraseña SMTP
  }
});

/**
 * Envío un email con contenido HTML y opcionalmente attachments.
 * @param {string[]} to           Lista de destinatarios
 * @param {string} subject        Asunto del correo
 * @param {string} html           Contenido HTML del correo
 * @param {Array<Object>} [attachments]  Adjuntos para email (con cid si aplica)
 */
async function sendMail({ to, subject, html, attachments = [] }) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,      // Remitente
    to: to.join(','),                 // Uno los destinatarios en una cadena
    subject,                          // Asigno el asunto
    html,                             // Asigno el contenido HTML
    attachments                       // Agrego attachments (p.ej. imagen embebida)
  });
}

module.exports = { sendMail }; // Exporto la función de envío de correos