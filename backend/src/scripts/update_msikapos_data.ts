// @ts-nocheck

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updateCategorization = async () => {
  console.log('Starting MsikaPos data update...');

  // 1. Target categories with upsert on slug
  const catStationeryServices = await prisma.category.upsert({
    where: { slug: 'stationery-services' },
    update: { title: 'Stationery Services' },
    create: { slug: 'stationery-services', title: 'Stationery Services' }
  });

  const catTechSolutions = await prisma.category.upsert({
    where: { slug: 'tech-solutions' },
    update: { title: 'Phones and Computer Tech Solutions' },
    create: { slug: 'tech-solutions', title: 'Phones and Computer Tech Solutions' }
  });

  const catPhoneAccessories = await prisma.category.upsert({
    where: { slug: 'phone-accessories' },
    update: { title: 'Phone Accessories' },
    create: { slug: 'phone-accessories', title: 'Phone Accessories' }
  });

  const catStationeryItems = await prisma.category.upsert({
    where: { slug: 'stationery-items' },
    update: { title: 'Stationery Items' },
    create: { slug: 'stationery-items', title: 'Stationery Items' }
  });

  // 2. Define products
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

  // 3. Upsert products
  const upsertProducts = async (items: any[], catId: number, prefix: string) => {
    for (const s of items) {
      const sku = `${prefix}-${s.name.toUpperCase().replace(/\s/g, '-')}`;
      await prisma.product.upsert({
        where: { sku },
        update: { 
          categoryId: catId, 
          description: s.desc,
          sellPrice: s.price,
          isService: true
        },
        create: {
          sku,
          name: s.name,
          categoryId: catId,
          description: s.desc,
          costPrice: s.price / 2,
          sellPrice: s.price,
          isService: true,
          quantity: 1
        }
      });
    }
  };

  await upsertProducts(stationeryServices, catStationeryServices.id, 'SR');
  await upsertProducts(techSolutions, catTechSolutions.id, 'TC');

  console.log('MsikaPos data update completed successfully.');
};

updateCategorization()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

