import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const saveSettings = async (req: Request, res: Response) => {
  const { 
    companyName, logo, slogan, address, phone, email, 
    primaryColor, currency, tax_config, global_discount 
  } = req.body;

  try {
    let settings = await prisma.companySettings.findFirst();
    
    const data: any = {
      companyName: companyName !== undefined ? companyName : settings?.companyName,
      logo: logo !== undefined ? logo : settings?.logo,
      slogan: slogan !== undefined ? slogan : settings?.slogan,
      address: address !== undefined ? address : settings?.address,
      phone: phone !== undefined ? phone : settings?.phone,
      email: email !== undefined ? email : settings?.email,
      primaryColor: primaryColor !== undefined ? primaryColor : settings?.primaryColor,
      currency: currency !== undefined ? currency : settings?.currency,
      tax_config: tax_config !== undefined ? tax_config : settings?.tax_config,
      global_discount: global_discount !== undefined ? Number(global_discount) : settings?.global_discount
    };

    if (settings) {
      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data
      });
    } else {
      settings = await prisma.companySettings.create({
        data
      });
    }

    res.status(200).json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
