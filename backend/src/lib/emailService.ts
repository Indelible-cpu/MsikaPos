import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Robust Email Transporter Configuration
 * Using explicit host/port for Gmail to avoid issues with the 'gmail' service shortcut.
 */
const port = Number(process.env.SMTP_PORT) || 465;
const host = process.env.SMTP_HOST || 'smtp.gmail.com';

const transporterConfig: any = {
  host: host,
  port: port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
};

// Use service shortcut for Gmail as it handles many common issues internally
if (host.includes('gmail.com')) {
  delete transporterConfig.host;
  delete transporterConfig.port;
  delete transporterConfig.secure;
  transporterConfig.service = 'gmail';
} else if (port === 587) {
  transporterConfig.requireTLS = true;
}

const transporter = nodemailer.createTransport(transporterConfig);

// Verify connection configuration on startup
console.log('📧 Email Service Initializing...');
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  console.log(`📧 SMTP Detected: User=${process.env.SMTP_USER}, Host=${host}, Port=${port}`);
  transporter.verify((error) => {
    if (error) {
      console.error('❌ SMTP Connection Error:', error);
    } else {
      console.log('✅ SMTP Server is ready to take our messages');
    }
  });
} else {
  console.warn('⚠️ SMTP Credentials missing in process.env!');
  if (!process.env.SMTP_USER) console.warn('   - SMTP_USER is missing');
  if (!process.env.SMTP_PASS) console.warn('   - SMTP_PASS is missing');
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
