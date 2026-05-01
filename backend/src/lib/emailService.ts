import nodemailer from 'nodemailer';
import dns from 'dns';

// Force Node.js to prioritize IPv4 over IPv6
// This resolves ENETUNREACH issues on environments like Render that don't support IPv6
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}


/**
 * Robust Email Transporter Configuration
 * Using explicit host/port for Gmail to avoid issues with the 'gmail' service shortcut.
 */
const port = Number(process.env.SMTP_PORT) || 587;
const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const secure = port === 465;

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
} else {
  console.warn('⚠️ SMTP Credentials missing in process.env!');
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
    console.error('❌ Cannot send email: SMTP Credentials missing.');
    return;
  }

  const mailOptions = {
    from: options.from || `"MsikaPos Support" <${process.env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    console.log(`✉️ Sending email to: ${options.to} (Subject: ${options.subject})`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error: any) {
    console.error(`❌ SMTP sendMail failed for ${options.to}:`, error);
    // Log more details if available
    if (error.code) console.error(`   Error Code: ${error.code}`);
    if (error.command) console.error(`   SMTP Command: ${error.command}`);
    if (error.response) console.error(`   SMTP Response: ${error.response}`);
    throw error;
  }
};

export default { sendMail };
