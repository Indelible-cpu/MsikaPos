import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const saveSettings = async (req: Request, res: Response) => {
  const { companyName, logo, slogan, address, phone, email } = req.body;

  try {
    let settings = await prisma.companySettings.findFirst();
    
    if (settings) {
      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: {
          companyName: companyName !== undefined ? companyName : settings.companyName,
          logo: logo !== undefined ? logo : settings.logo,
          slogan: slogan !== undefined ? slogan : settings.slogan,
          address: address !== undefined ? address : settings.address,
          phone: phone !== undefined ? phone : settings.phone,
          email: email !== undefined ? email : settings.email
        }
      });
    } else {
      settings = await prisma.companySettings.create({
        data: {
          companyName,
          logo,
          slogan,
          address,
          phone,
          email
        }
      });
    }

    res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
