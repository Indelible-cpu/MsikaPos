import { getClientIp } from '../lib/ipHelper';

console.log('🧪 Starting IP Helper Tests...');

const testCases = [
  {
    name: 'Standard Direct Request (IPv4)',
    req: {
      socket: { remoteAddress: '203.0.113.195' },
      headers: {}
    },
    expectedIp: '203.0.113.195',
    expectedSource: 'Remote Address'
  },
  {
    name: 'Cloudflare Proxy (Standard Public IP)',
    req: {
      socket: { remoteAddress: '172.67.128.1' }, // Cloudflare IP
      headers: {
        'cf-connecting-ip': '198.51.100.42'
      }
    },
    expectedIp: '198.51.100.42',
    expectedSource: 'CF-Connecting-IP'
  },
  {
    name: 'Multiple Proxies in X-Forwarded-For (Get first public)',
    req: {
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        'x-forwarded-for': '10.0.0.5, 198.51.100.99, 192.168.1.5'
      }
    },
    expectedIp: '198.51.100.99',
    expectedSource: 'X-Forwarded-For'
  },
  {
    name: 'Cloudflare Header with Port & Brackets',
    req: {
      socket: { remoteAddress: '::1' },
      headers: {
        'cf-connecting-ip': '[2001:db8:85a3:8d3:1319:8a2e:370:7348]:443'
      }
    },
    expectedIp: '2001:db8:85a3:8d3:1319:8a2e:370:7348',
    expectedSource: 'CF-Connecting-IP'
  },
  {
    name: 'Local Dev behind proxy (All Private IPs)',
    req: {
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        'cf-connecting-ip': '192.168.10.45'
      }
    },
    expectedIp: '192.168.10.45',
    expectedSource: 'CF-Connecting-IP'
  },
  {
    name: 'Next.js App Router Request Mock',
    req: {
      ip: '203.0.113.50',
      headers: {
        get: (name: string) => {
          if (name === 'cf-connecting-ip') return '198.51.100.5';
          return null;
        }
      }
    },
    expectedIp: '198.51.100.5',
    expectedSource: 'CF-Connecting-IP'
  }
];

let failed = false;
for (const tc of testCases) {
  const result = getClientIp(tc.req);
  if (result.ip === tc.expectedIp && result.source === tc.expectedSource) {
    console.log(`✅ Passed: ${tc.name}`);
  } else {
    console.error(`❌ Failed: ${tc.name}`);
    console.error(`   Expected: IP="${tc.expectedIp}", Source="${tc.expectedSource}"`);
    console.error(`   Got:      IP="${result.ip}", Source="${result.source}"`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('🎉 All test cases passed successfully!');
}
