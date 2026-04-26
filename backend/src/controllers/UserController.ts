import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const loginUser = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user || user.deleted) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const normalizedHash = user.password.replace(/^\$2y\$/, '$2a$');
    const validPassword = await bcrypt.compare(password, normalizedHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
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
    const where: any = { deleted: false };
    if (authUser.role !== 'SUPERADMIN' && authUser.branchId) {
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
        createdAt: u.createdAt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
};

export const saveUser = async (req: Request, res: Response) => {
  const { id, username, password, roleId, branchId } = req.body;

  try {
    if (id) {
      const data: any = {
        username,
        roleId: parseInt(roleId),
        branchId: branchId ? parseInt(branchId) : null,
      };

      if (password) {
        data.password = await bcrypt.hash(password, 10);
        data.mustChangePassword = false;
      }

      await prisma.user.update({
        where: { id: parseInt(id) },
        data,
      });

      return res.status(200).json({ success: true, message: "User updated" });
      const magicToken = crypto.randomBytes(32).toString('hex');
      const magicTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const newUser = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          roleId: parseInt(roleId),
          branchId: branchId ? parseInt(branchId) : null,
          mustChangePassword: true,
          isVerified: false,
          magicToken,
          magicTokenExpires
        },
      });

      return res.status(201).json({
        success: true,
        message: "User created",
        data: { 
          username, 
          tempPassword: password ? undefined : tempPassword,
          magicToken 
        }
      });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to save user', error: error.message });
  }
};

export const updateOnboarding = async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const {
    fullname,
    nationalId,
    phone,
    email,
    profilePic,
    homeAddress,
    nextOfKinPhone,
    relationship,
    newPassword
  } = req.body;

  try {
      nationalId,
      phone,
      email,
      profilePic,
      homeAddress,
      nextOfKinName,
      nextOfKinPhone,
      relationship,
      verificationCode: Math.floor(100000 + Math.random() * 900000).toString(),
      magicToken: null, // Clear magic token once used/profile updated
      magicTokenExpires: null
    };

    if (newPassword) {
      data.password = await bcrypt.hash(newPassword, 10);
      data.mustChangePassword = false;
    }

    const user = await prisma.user.update({
      where: { id: authUser.id },
      data
    });

    // Send Verification Email (Background)
    if (email) {
      console.log(`✉️ Attempting to send verification email to: ${email}`);
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('❌ SMTP Credentials missing in Environment Variables!');
      } else {
        transporter.sendMail({
          from: `"MsikaPos Security" <${process.env.SMTP_USER}>`,
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
        }).then(() => {
          console.log(`✅ Verification email sent successfully to: ${email}`);
        }).catch(err => {
          console.error('❌ Verification email failed:', err);
        });
      }
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

  try {
    const user = await prisma.user.findFirst({
      where: { username, email, deleted: false }
    });

    if (user) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: code }
      });

      transporter.sendMail({
        from: `"MsikaPos Support" <${process.env.SMTP_USER}>`,
        to: email,
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

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.user.update({
      where: { id: parseInt(id as string) },
      data: { deleted: true },
    });

    return res.status(200).json({ success: true, message: "User deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
  }
};

export const magicLogin = async (req: Request, res: Response) => {
  const { token } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        magicToken: token,
        magicTokenExpires: { gt: new Date() },
        deleted: false
      },
      include: { role: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired magic link' });
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
