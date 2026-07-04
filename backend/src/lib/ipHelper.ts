/**
 * Helper to clean up IP addresses, resolving brackets and ports
 */
export function cleanIp(ip: string): string {
  let cleaned = ip.trim();
  
  // IPv4-mapped IPv6 address (e.g., ::ffff:192.168.1.1)
  if (cleaned.startsWith('::ffff:')) {
    cleaned = cleaned.substring(7);
  }

  // IPv6 wrapped in brackets with port, e.g. [::1]:8080 or [2001:db8::1]:1234
  if (cleaned.startsWith('[') && cleaned.includes(']')) {
    const endBracketIndex = cleaned.indexOf(']');
    cleaned = cleaned.substring(1, endBracketIndex);
  } else if (cleaned.includes('.')) {
    // IPv4 with port, e.g. 127.0.0.1:8080 (but make sure it's not IPv6 with multiple colons)
    if (!cleaned.includes(':') || (cleaned.split(':').length === 2)) {
      cleaned = cleaned.split(':')[0] || cleaned;
    }
  }
  
  return cleaned;
}

/**
 * Checks if an IP address falls within private, loopback, or reserved ranges
 */
export function isPrivateIp(ip: string): boolean {
  const cleaned = cleanIp(ip);
  if (!cleaned || cleaned === 'unknown') return true;

  // IPv4 check
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.').map(p => parseInt(p, 10));
    if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
      const [p1, p2] = parts;
      if (p1 === undefined) return false;
      // Loopback: 127.0.0.0/8
      if (p1 === 127) return true;
      // Private Class A: 10.0.0.0/8
      if (p1 === 10) return true;
      // Private Class B: 172.16.0.0/12
      if (p1 === 172 && p2 !== undefined && p2 >= 16 && p2 <= 31) return true;
      // Private Class C: 192.168.0.0/16
      if (p1 === 192 && p2 === 168) return true;
      // Link-local: 169.254.0.0/16
      if (p1 === 169 && p2 === 254) return true;
      // Local broadcast/multicast/reserved: 0.0.0.0/8, 224.0.0.0/4, 240.0.0.0/4
      if (p1 === 0 || p1 >= 224) return true;
      
      return false;
    }
  }

  // IPv6 check
  const lower = cleaned.toLowerCase();
  // Loopback: ::1 or 0:0:0:0:0:0:0:1
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1' || lower === '::') {
    return true;
  }
  // Unique Local Address: fc00::/7 (starts with fc or fd)
  if (lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }
  // Link-local: fe80::/10 (starts with fe8, fe9, fea, feb)
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true;
  }
  // Multicast: ff00::/8
  if (lower.startsWith('ff')) {
    return true;
  }

  return false;
}

/**
 * Checks if the IP is a valid public IP (well-formed and not in a private/reserved range)
 */
export function isValidPublicIp(ip: string): boolean {
  if (!ip) return false;
  const cleaned = cleanIp(ip);
  
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length !== 4) return false;
    if (parts.some(p => {
      const n = parseInt(p, 10);
      return isNaN(n) || n < 0 || n > 255 || n.toString() !== p;
    })) {
      return false;
    }
  } else if (cleaned.includes(':')) {
    const hexRegex = /^[0-9a-fA-F:]+$/;
    if (!hexRegex.test(cleaned)) return false;
  } else {
    return false;
  }
  
  return !isPrivateIp(cleaned);
}

export interface ClientIpInfo {
  ip: string;
  source: 'CF-Connecting-IP' | 'X-Forwarded-For' | 'X-Real-IP' | 'Remote Address' | 'unknown';
}

/**
 * Resolves the real visitor client IP address behind Cloudflare or other proxies,
 * ignoring private and reserved IP ranges whenever a valid public IP is available.
 * 
 * Compatible with Node.js/Express (IncomingMessage) and Next.js (NextApiRequest/NextRequest).
 */
export function getClientIp(req: any): ClientIpInfo {
  if (!req) {
    return { ip: 'unknown', source: 'unknown' };
  }

  // Retrieve header case-insensitively, supporting Web Headers object and standard Node objects
  const getHeader = (name: string): string | undefined => {
    if (!req.headers) return undefined;
    
    if (typeof req.headers.get === 'function') {
      return req.headers.get(name) || undefined;
    }
    
    const value = req.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value || undefined;
  };

  const getRemoteAddress = (): string | undefined => {
    if (req.socket?.remoteAddress) return req.socket.remoteAddress;
    if (req.connection?.remoteAddress) return req.connection.remoteAddress;
    if (req.info?.remoteAddress) return req.info.remoteAddress;
    if (req.ip) return req.ip;
    return undefined;
  };

  // 1. CF-Connecting-IP
  const cfConnecting = getHeader('cf-connecting-ip');
  if (cfConnecting) {
    const cleaned = cleanIp(cfConnecting);
    if (isValidPublicIp(cleaned)) {
      return { ip: cleaned, source: 'CF-Connecting-IP' };
    }
  }

  // 2. X-Forwarded-For (use the first public IP in the list)
  const xForwardedFor = getHeader('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => cleanIp(ip));
    const firstPublic = ips.find(ip => isValidPublicIp(ip));
    if (firstPublic) {
      return { ip: firstPublic, source: 'X-Forwarded-For' };
    }
  }

  // 3. X-Real-IP
  const xReal = getHeader('x-real-ip');
  if (xReal) {
    const cleaned = cleanIp(xReal);
    if (isValidPublicIp(cleaned)) {
      return { ip: cleaned, source: 'X-Real-IP' };
    }
  }

  // 4. Remote Address (Public)
  const remoteAddr = getRemoteAddress();
  if (remoteAddr) {
    const cleaned = cleanIp(remoteAddr);
    if (isValidPublicIp(cleaned)) {
      return { ip: cleaned, source: 'Remote Address' };
    }
  }

  // Fallback pass: If no valid public IP is found in the headers, but we have a private IP candidate
  // in one of the proxy headers, prefer that private IP over the local socket address.
  if (cfConnecting) {
    const cleaned = cleanIp(cfConnecting);
    if (cleaned) {
      return { ip: cleaned, source: 'CF-Connecting-IP' };
    }
  }
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => cleanIp(ip));
    if (ips.length > 0 && ips[0]) {
      return { ip: ips[0], source: 'X-Forwarded-For' };
    }
  }
  if (xReal) {
    const cleaned = cleanIp(xReal);
    if (cleaned) {
      return { ip: cleaned, source: 'X-Real-IP' };
    }
  }

  // 5. Finally, fallback to Remote Address even if private
  if (remoteAddr) {
    const cleaned = cleanIp(remoteAddr);
    if (cleaned) {
      return { ip: cleaned, source: 'Remote Address' };
    }
  }

  return { ip: 'unknown', source: 'unknown' };
}
