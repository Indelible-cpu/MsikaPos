import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { prisma } from '../lib/prisma';
import nodemailer from 'nodemailer';

// Email transporter for alerts
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// 1. HELMET for secure headers
export const securityHeaders = helmet({
  crossOriginResourcePolicy: false,
});

// 2. RATE LIMITER (Global)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased for staff efficiency in multi-tab usage
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. AUTH LIMITER (More strict for login)
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // More headroom for staff login retries
  message: 'Too many login attempts, your IP has been flagged',
  skipSuccessfulRequests: true,
});

// 4. PARAMETER POLLUTION PREVENTION
export const parameterPollution = hpp();

// 5. IP BLOCKER MIDDLEWARE with In-Memory Cache
const ipCache = new Map<string, { blocked: boolean; reason?: string; expiresAt?: Date | null; lastChecked: number }>();
const IP_CACHE_TTL = 60 * 1000; // 1 minute

export const ipBlocker = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Check Cache first
  const cached = ipCache.get(ip);
  if (cached && (now - cached.lastChecked < IP_CACHE_TTL)) {
    if (cached.blocked) {
      if (cached.expiresAt && cached.expiresAt < new Date()) {
        ipCache.delete(ip); // Expired in cache, proceed to DB/Next
      } else {
        return res.status(403).json({ 
          message: 'Your access has been restricted due to suspicious activity.',
          reason: cached.reason 
        });
      }
    } else {
      return next(); // Not blocked according to cache
    }
  }

  try {
    const blocked = await prisma.blockedIP.findUnique({
      where: { ipAddress: ip }
    });

    if (blocked) {
      if (blocked.expiresAt && blocked.expiresAt < new Date()) {
        await prisma.blockedIP.delete({ where: { id: blocked.id } });
        ipCache.set(ip, { blocked: false, lastChecked: now });
      } else {
        ipCache.set(ip, { 
          blocked: true, 
          reason: blocked.reason, 
          expiresAt: blocked.expiresAt, 
          lastChecked: now 
        });
        return res.status(403).json({ 
          message: 'Your access has been restricted due to suspicious activity.',
          reason: blocked.reason 
        });
      }
    } else {
      // Not blocked, cache the negative result
      ipCache.set(ip, { blocked: false, lastChecked: now });
    }
    next();
  } catch (error) {
    next(); // Don't block if DB is down
  }
};

// 6. INTRUSION DETECTION & ALERTING
export const securityAlert = async (ip: string, event: string, details: string) => {
  try {
    // Log to DB
    await prisma.securityLog.create({
      data: { ipAddress: ip, event, details }
    });

    // Check if we should block (e.g. 5 security events in 10 mins)
    const recentEvents = await prisma.securityLog.count({
      where: {
        ipAddress: ip,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
      }
    });

    if (recentEvents >= 5) {
      await prisma.blockedIP.upsert({
        where: { ipAddress: ip },
        update: { reason: `Repeated security violations: ${event}` },
        create: { 
          ipAddress: ip, 
          reason: `Repeated security violations: ${event}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h block
        }
      });
    }

    // Notify Super Admin
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER, // Assuming admin email is SMTP_USER or add a separate env
      subject: '🚨 SECURITY ALERT: MsikaPos Intrusion Attempt',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 2px solid #ef4444; border-radius: 10px;">
          <h1 style="color: #ef4444; margin-top: 0;">Security Threat Detected</h1>
          <p>The system has detected a potential attack from IP: <strong>${ip}</strong></p>
          <hr />
          <p><strong>Event:</strong> ${event}</p>
          <p><strong>Details:</strong> ${details}</p>
          <p><strong>Recent Attempts:</strong> ${recentEvents}</p>
          <hr />
          <p style="font-size: 12px; color: #666;">
            MsikaPos Automated Security System<br />
            Status: ${recentEvents >= 5 ? 'IP PERMANENTLY LOCKED' : 'IP UNDER SURVEILLANCE'}
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`🚨 Security Alert Sent: ${event} from ${ip}`);
  } catch (err) {
    console.error('Failed to send security alert:', err);
  }
};
