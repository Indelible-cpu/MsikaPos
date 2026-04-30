import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    branchId?: number | null;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    console.warn(`🔓 Auth Blocked: Missing token for ${req.method} ${req.originalUrl} from ${req.ip}`);
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    
    // Multi-branch context handling
    const requestedBranchId = req.headers['x-branch-id'];
    
    if (decoded.role === 'SUPER_ADMIN') {
      // Super Admin can switch context via header
      decoded.branchId = requestedBranchId ? parseInt(requestedBranchId as string) : null;
    } else {
      // Non-Super Admins are LOCKED to their token's branchId
      // They cannot spoof other branches via header
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('🔓 Auth Failure:', error.message || 'Invalid token');
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    next();
  };
};
