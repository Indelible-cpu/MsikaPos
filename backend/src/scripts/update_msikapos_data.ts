
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updateCategorization = async () => {
  console.log('Starting MsikaPos data update...');

  // Helper to get or create category by slug
  const getCategory = async (slug: string, title: string) => {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return await prisma.category.update({
        where: { slug },
        data: { title }
      });
    }
    return await prisma.category.create({
      data: { slug, title }
    });
  };

  // 1. Get target categories
  const catStationeryServices = await getCategory('stationery-services', 'Stationery Services');
  const catTechSolutions = await getCategory('tech-solutions', 'Phones and Computer Tech Solutions');
  const catPhoneAccessories = await getCategory('phone-accessories', 'Phone Accessories');
  const catStationeryItems = await getCategory('stationery-items', 'Stationery Items');

  // 2. Define product mappings
  const stationeryServices = [
    { name: 'Printing', price: 300, desc: 'High-quality document printing.' },
    { name: 'Scanning', price: 500, desc: 'Fast document scanning to PDF/Image.' },
    { name: 'Designing', price: 5000, desc: 'Professional graphic design services.' },
    { name: 'Photocopying', price: 250, desc: 'Clear and sharp photocopying.' },
    { name: 'Lamination', price: 2000, desc: 'Durable document protection.' },
    { name: 'Typing', price: 350, desc: 'Professional typing and formatting.' }
  ];

  const techSolutions = [
    { name: 'Password Removal', price: 15000, desc: 'Securely unlock devices.' },
    { name: 'FRP Removal', price: 15000, desc: 'Google account bypass service.' },
    { name: 'WhatsApp Fixing', price: 2500, desc: 'Restore and fix WhatsApp issues.' },
    { name: 'Email Account Opening', price: 5000, desc: 'Official email setup assistance.' },
    { name: 'Email Recoverying', price: 10000, desc: 'Account recovery services.' },
    { name: 'Software Upgrading', price: 15000, desc: 'OS and app updates for performance.' },
    { name: 'Windows Instalation', price: 25000, desc: 'Fresh OS install with drivers.' },
    { name: 'Windows Activation', price: 10000, desc: 'Genuine Windows activation.' }
  ];

  // 3. Update Stationery Services
  for (const s of stationeryServices) {
    const sku = `SR-${s.name.toUpperCase().replace(/\s/g, '-')}`;
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) {
      await prisma.product.update({
        where: { sku },
        data: { 
          categoryId: catStationeryServices.id, 
          description: s.desc,
          sellPrice: s.price,
          isService: true
        }
      });
    } else {
      await prisma.product.create({
        data: {
          sku,
          name: s.name,
          categoryId: catStationeryServices.id,
          description: s.desc,
          costPrice: s.price / 2,
          sellPrice: s.price,
          isService: true,
          quantity: 1
        }
      });
    }
  }

  // 4. Update Tech Solutions
  for (const s of techSolutions) {
    const sku = `TC-${s.name.toUpperCase().replace(/\s/g, '-')}`;
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) {
      await prisma.product.update({
        where: { sku },
        data: { 
          categoryId: catTechSolutions.id, 
          description: s.desc,
          sellPrice: s.price,
          isService: true
        }
      });
    } else {
      await prisma.product.create({
        data: {
          sku,
          name: s.name,
          categoryId: catTechSolutions.id,
          description: s.desc,
          costPrice: s.price / 2,
          sellPrice: s.price,
          isService: true,
          quantity: 1
        }
      });
    }
  }

  console.log('MsikaPos data update completed successfully.');
};

updateCategorization()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
