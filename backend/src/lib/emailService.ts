import dns from 'dns';

// Force Node.js to prioritize IPv4 over IPv6
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

export interface MailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

/**
 * Robust Email Service using Brevo API (HTTP)
 * This bypasses all SMTP blocks on Render by using standard HTTPS (Port 443).
 */
export const sendMail = async (options: MailOptions) => {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn('❌ BREVO_API_KEY missing in environment variables.');
    return;
  }

  const cleanTo = options.to.trim();
  console.log(`✉️ Sending email via Brevo API to: ${cleanTo} (Subject: ${options.subject})`);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { 
          name: "MsikaPos", 
          email: process.env.SMTP_USER || "onboarding@brevo.com" 
        },
        to: [{ email: cleanTo }],
        subject: options.subject,
        htmlContent: options.html || options.text,
        textContent: options.text
      })
    });

    const data = await response.json() as any;

    if (response.ok) {
      console.log(`✅ Email sent successfully via Brevo API! Message ID: ${data.messageId}`);
      return { messageId: data.messageId };
    } else {
      console.error('❌ Brevo API Error:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Network error sending email via Brevo:', error);
    return null;
  }
};

// Log initialization status
if (process.env.BREVO_API_KEY) {
  console.log('📧 Email Service: Brevo API initialized and ready.');
} else {
  console.log('📧 Email Service: Waiting for BREVO_API_KEY in Render environment variables.');
}

export default { sendMail };
