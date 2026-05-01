import nodemailer from 'nodemailer';
import dns from 'dns';

// Force Node.js to prioritize IPv4 over IPv6
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const port = Number(process.env.SMTP_PORT) || 587;
const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const secure = port === 465; // Only 465 uses 'secure: true'

console.log(`📧 Email Service Initializing... Host=${host}, Port=${port}, Secure=${secure}`);

const transporter = nodemailer.createTransport({
  host: host,
  port: port,
  secure: secure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    servername: 'smtp.gmail.com'
  },
  requireTLS: port === 587,
  pool: true,
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
  logger: true,
  debug: true
});

// Verify connection configuration on startup
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  console.log('📧 SMTP: Verifying connection...');
  transporter.verify((error) => {
    if (error) {
      console.error('❌ SMTP Verification Failed:', error);
    } else {
      console.log('✅ SMTP Verification Success: Server is ready');
    }
  });
}

export interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export const sendMail = async (options: MailOptions) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Cannot send email: SMTP Credentials missing in environment variables.');
    return;
  }

  const mailOptions = {
    from: options.from || `"MsikaPos" <${process.env.SMTP_USER}>`,
    to: options.to.trim(),
    subject: options.subject,
    text: options.text,
    html: options.html || options.text,
  };

  try {
    console.log(`✉️ Sending SMTP email to: ${mailOptions.to} (Subject: ${options.subject})`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully! MessageID: ${info.messageId}`);
    return info;
  } catch (error: any) {
    console.error(`❌ SMTP sendMail failed for ${mailOptions.to}:`, error);
    throw error;
  }
};

export default { sendMail };
