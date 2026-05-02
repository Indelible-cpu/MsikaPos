import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendMail } from '../lib/emailService';
import { securityAlert } from '../middleware/security';
import { normalizePhone, isValidMalawianPhone } from '../lib/phoneUtils';

// Centralized email service is used instead of local transporter

export const loginUser = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user || user.deleted) {
      await securityAlert(req.ip || 'unknown', 'BRUTE_FORCE', `Failed login attempt for non-existent user: ${username}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const normalizedHash = user.password.replace(/^\$2y\$/, '$2a$');
    const validPassword = await bcrypt.compare(password, normalizedHash);
    if (!validPassword) {
      await securityAlert(req.ip || 'unknown', 'BRUTE_FORCE', `Incorrect password for user: ${username}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: `Account is ${user.status.toLowerCase()}` });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role.name, branchId: user.branchId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role.name,
        branch_id: user.branchId,
        mustChangePassword: user.mustChangePassword,
        isVerified: user.isVerified,
        profilePic: user.profilePic
      },
    });
  } catch (error: any) {
    console.error('Login Error:', error);
    return res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
};

export const fetchUsers = async (req: Request, res: Response) => {
  const authUser = (req as any).user;

  try {
    const where: any = { 
      deleted: false,
      role: { name: { not: 'CUSTOMER' } }
    };
    // Strict Branch Isolation / Context Switch
    if (authUser.branchId) {
      where.branchId = authUser.branchId;
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        role: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: users.map((u: any) => ({
        id: u.id,
        username: u.username,
        fullname: u.fullname,
        email: u.email,
        phone: u.phone,
        role: u.role.name,
        branch_id: u.branchId,
        branch_name: u.branch?.name || 'N/A',
        isVerified: u.isVerified,
        status: u.status,
        createdAt: u.createdAt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
};

export const saveUser = async (req: Request, res: Response) => {
  const { id, username, password, roleId, branchId, fullname, email, phone } = req.body;

  try {
    if (phone && !isValidMalawianPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid Malawian phone number' });
    }

    const rId = parseInt(roleId as any);
    const bId = branchId ? parseInt(branchId as any) : null;

    if (id) {
      const data: any = {
        username,
        fullname,
        email,
        phone: normalizePhone(phone),
        roleId: rId,
        branchId: bId,
      };

      if (password) {
        data.password = await bcrypt.hash(password, 10);
        data.mustChangePassword = false;
      }

      await prisma.user.update({
        where: { id: parseInt(id as any) },
        data,
      });

      return res.status(200).json({ success: true, message: "User updated" });
    } else {
      // Check if username exists
      const exists = await prisma.user.findUnique({ where: { username } });
      if (exists) return res.status(400).json({ success: false, message: "Username already taken" });

      const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 char hex
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const magicToken = crypto.randomBytes(32).toString('hex');
      const magicTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      try {
        await prisma.user.create({
          data: {
            username,
            fullname,
            email,
            phone: normalizePhone(phone),
            password: hashedPassword,
            roleId: rId,
            branchId: bId,
            mustChangePassword: true,
            isVerified: false,
            magicToken,
            magicTokenExpires
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002' && err.meta?.target?.includes('username')) {
          return res.status(400).json({ success: false, message: "Username already taken" });
        }
        throw err;
      }

      return res.status(201).json({
        success: true,
        message: "User created",
        data: { 
          username, 
          tempPassword,
          magicToken 
        }
      });
    }
  } catch (error: any) {
    console.error('Save User Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save user', error: error.message });
  }
};

export const updateOnboarding = async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const {
    fullname,
    nationalId,
    phone,
    profilePic,
    homeAddress,
    nextOfKinName,
    nextOfKinPhone,
    relationship,
    newPassword
  } = req.body;
  const email = req.body.email?.trim();

  try {
    if (phone && !isValidMalawianPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number format' });
    }
    if (nextOfKinPhone && !isValidMalawianPhone(nextOfKinPhone)) {
      return res.status(400).json({ success: false, message: 'Invalid next of kin phone number format' });
    }

    if (nationalId && !/^[A-Z0-9]{8}$/.test(nationalId.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'National ID must be 8 alphanumeric characters' });
    }

    const data: any = {
      fullname,
      nationalId: nationalId?.toUpperCase(),
      phone: normalizePhone(phone),
      email,
      profilePic,
      homeAddress,
      nextOfKinName,
      nextOfKinPhone: normalizePhone(nextOfKinPhone),
      relationship,
      verificationCode: Math.floor(100000 + Math.random() * 900000).toString(),
      magicToken: null, // Clear magic token once used/profile updated
      magicTokenExpires: null
    };

    if (newPassword) {
      data.password = await bcrypt.hash(newPassword, 10);
      data.mustChangePassword = false;
    }

    await prisma.user.update({
      where: { id: authUser.id },
      data
    });

    // Send Verification Email (Background)
    if (email) {
      sendMail({
        to: email,
        subject: "MsikaPos Account Verification",
        text: `Your MsikaPos verification code is: ${data.verificationCode}. For security reasons, do not share this code with anyone.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #10b981;">Account Verification</h2>
            <p>Your verification code is: <strong style="font-size: 24px; letter-spacing: 2px;">${data.verificationCode}</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #ef4444; font-weight: bold;">⚠️ Security Warning: Do not share this code with anyone. MsikaPos staff will never ask for your code.</p>
          </div>
        `
      }).catch(err => {
        console.error('❌ Verification email failed:', err);
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated. Verification code sent to email."
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Onboarding failed', error: error.message });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const { code } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user || user.verificationCode !== code) {
      return res.status(400).json({ success: false, message: "Invalid verification code" });
    }

    await prisma.user.update({
      where: { id: authUser.id },
      data: { isVerified: true, verificationCode: null }
    });

    return res.status(200).json({ success: true, message: "Email verified. System unlocked." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Verification failed', error: error.message });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { username, email } = req.body;
  const cleanUsername = username?.trim();
  const cleanEmail = email?.trim();

  try {
    const user = await prisma.user.findFirst({
      where: { 
        username: cleanUsername, 
        email: { equals: cleanEmail, mode: 'insensitive' },
        deleted: false 
      }
    });

    if (user) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: code }
      });

      sendMail({
        to: cleanEmail,
        subject: "Password Reset Code",
        text: `Your MsikaPos password reset code is: ${code}. For security reasons, do not share this code with anyone.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #10b981;">Password Reset Request</h2>
            <p>Your reset code is: <strong style="font-size: 24px; letter-spacing: 2px;">${code}</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #ef4444; font-weight: bold;">⚠️ Security Warning: Do not share this code with anyone. Keep it secure to protect your account.</p>
          </div>
        `
      }).catch(err => console.error('Forgot password email failed:', err));

      return res.status(200).json({
        success: true,
        message: "Verification code sent to email."
      });
    } else {
      // Notify Admin
      await prisma.syncLog.create({
        data: {
          deviceId: 'SYSTEM',
          userId: 0,
          action: 'FORGOT_PASSWORD_ATTEMPT',
          status: 'WARNING',
          details: `User ${username} with email ${email} attempted password reset but details don't match.`
        }
      });

      return res.status(404).json({
        success: false,
        message: "Details not found. Admin has been notified for manual reset."
      });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Request failed', error: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { code, newPassword } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: { 
        verificationCode: code,
        deleted: false 
      }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        verificationCode: null, // Clear code once used
        isVerified: true,       // Mark as verified if they reset successfully
        mustChangePassword: false
      }
    });

    // Log the security event
    await prisma.syncLog.create({
      data: {
        deviceId: 'SYSTEM',
        userId: user.id,
        action: 'PASSWORD_RESET_SUCCESS',
        status: 'INFO',
        details: `User ${user.username} successfully reset their password.`
      }
    });

    return res.status(200).json({ success: true, message: "Password reset successful! You can now login." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Reset failed', error: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, hardDelete } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(id as string) } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (hardDelete) {
      await prisma.user.delete({ where: { id: parseInt(id as string) } });
    } else {
      await prisma.user.update({
        where: { id: parseInt(id as string) },
        data: { deleted: true },
      });
    }

    if (user.email) {
      sendMail({
        to: user.email,
        subject: `Account ${hardDelete ? 'Permanently Removed' : 'Deleted'}`,
        text: `Your account (${user.username}) has been ${hardDelete ? 'permanently removed' : 'deleted'} from MsikaPos.\n\nReason: ${reason || 'No reason provided.'}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #ef4444;">Account Notification</h2>
            <p>Your account (<strong>${user.username}</strong>) has been ${hardDelete ? 'permanently removed' : 'deleted'}.</p>
            <p><strong>Reason:</strong> ${reason || 'No reason provided.'}</p>
            <hr>
            <p style="font-size: 12px; color: #666;">If you believe this was an error, please contact the Super Administrator.</p>
          </div>
        `
      }).catch(console.error);
    }

    return res.status(200).json({ success: true, message: hardDelete ? "User permanently deleted" : "User soft-deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Action failed', error: error.message });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  const { id, status, reason } = req.body; // ACTIVE, SUSPENDED, DEACTIVATED

  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(id as string) } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await prisma.user.update({
      where: { id: parseInt(id as string) },
      data: { status }
    });

    if (user.email) {
      sendMail({
        to: user.email,
        subject: `Account Status Update: ${status}`,
        text: `Your account status has been changed to ${status}.\n\nReason: ${reason || 'Administrative action.'}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #3b82f6;">Account Status Update</h2>
            <p>Your account (<strong>${user.username}</strong>) status is now: <strong style="color: ${status === 'ACTIVE' ? '#10b981' : '#ef4444'};">${status}</strong></p>
            <p><strong>Reason:</strong> ${reason || 'Administrative action.'}</p>
            <hr>
            <p style="font-size: 12px; color: #666;">Contact the Super Administrator for more details.</p>
          </div>
        `
      }).catch(console.error);
    }

    return res.status(200).json({ success: true, message: `User ${status.toLowerCase()} successfully` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Status update failed', error: error.message });
  }
};

export const magicLogin = async (req: Request, res: Response) => {
  const { token } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        magicToken: token,
        deleted: false
      },
      include: { role: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or already used magic link' });
    }

    if (user.magicTokenExpires && user.magicTokenExpires < new Date()) {
      return res.status(401).json({ success: false, message: 'This magic link has expired' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ success: false, message: 'Account is not active' });
    }

    const jwtToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role.name, branchId: user.branchId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role.name,
        branchId: user.branchId,
        isVerified: user.isVerified,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Magic login failed', error: error.message });
  }
};
