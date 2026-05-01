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
 * Robust Email Service using Resend API (HTTP)
 * This bypasses SMTP blocks common on cloud platforms like Render.
 */
export const sendMail = async (options: MailOptions) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('❌ Resend API Key missing. Please set RESEND_API_KEY in Render environment variables.');
    console.log('🔗 Get a free key at: https://resend.com');
    return;
  }

  // Clean email input
  const cleanTo = options.to.trim();

  console.log(`✉️ Sending email via Resend API to: ${cleanTo} (Subject: ${options.subject})`);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // For free/onboarding accounts, Resend requires using onboarding@resend.dev
        // until you verify your custom domain.
        from: options.from || 'MsikaPos <onboarding@resend.dev>',
        to: [cleanTo],
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
      }),
    });

    const data = await response.json() as any;

    if (response.ok) {
      console.log(`✅ Email sent successfully via Resend! ID: ${data.id}`);
      return { messageId: data.id };
    } else {
      console.error('❌ Resend API Error:', data);
      
      // Special hint for unverified domains
      if (data.message && data.message.includes('domain')) {
        console.warn('💡 Tip: If you are using a free Resend account, you must send to your own email OR verify your domain.');
      }
      return null;
    }
  } catch (error) {
    console.error('❌ Network error sending email via Resend:', error);
    return null;
  }
};

// Log initialization status
if (process.env.RESEND_API_KEY) {
  console.log('📧 Email Service: Resend API initialized and ready.');
} else {
  console.log('📧 Email Service: Waiting for RESEND_API_KEY in Render environment variables.');
}

export default { sendMail };
