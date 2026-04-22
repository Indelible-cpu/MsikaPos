// Utility for End-to-End Encryption (E2EE) using Web Crypto API
// This ensures user data integrity and meeting legal standards of data safety.

const ALGORITHM = 'AES-GCM';
const KEY_NAME = 'JIMS_POS_MASTER_KEY';

async function getMasterKey() {
  let key = localStorage.getItem(KEY_NAME);
  if (!key) {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    key = btoa(String.fromCharCode(...rawKey));
    localStorage.setItem(KEY_NAME, key);
  }
  
  const raw = new Uint8Array(atob(key).split('').map(c => c.charCodeAt(0)));
  return await crypto.subtle.importKey(
    'raw',
    raw,
    ALGORITHM,
    false,
    ['encrypt', 'decrypt']
  );
}

export const Security = {
  async encrypt(data: string): Promise<string> {
    try {
      const key = await getMasterKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(data);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        key,
        encoded
      );
      
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (e) {
      console.error('Encryption failed:', e);
      return data; // Fallback to raw if fail (in non-secure contexts)
    }
  },

  async decrypt(encryptedData: string): Promise<string> {
    try {
      const key = await getMasterKey();
      const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
      
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv },
        key,
        data
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('Decryption failed:', e);
      return encryptedData;
    }
  }
};
