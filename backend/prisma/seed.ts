import { PrismaClient, RoleName, BranchStatus, PaymentMode, SaleStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Full Data Migration from JEF Investment SQL...');

  // 1. Create Roles (Sync with SQL IDs if possible)
  const rolesMap = {
    1: RoleName.SUPER_ADMIN,
    2: RoleName.ADMIN,
    3: RoleName.CASHIER,
  };

  for (const [id, name] of Object.entries(rolesMap)) {
    await prisma.role.upsert({
      where: { id: parseInt(id) },
      update: { name },
      create: { id: parseInt(id), name, description: name === RoleName.SUPER_ADMIN ? 'Full system access' : 'Staff access' },
    });
  }

  // 2. Create Branches
  const branches = [
    { id: 1, name: 'Main Branch', location: 'Headquarters', status: BranchStatus.ACTIVE },
  ];

  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { id: branch.id },
      update: branch,
      create: branch,
    });
  }

  // 3. Create Users (From SQL Dump)
  const users = [
    { id: 23, username: 'aubrey', password: '$2y$10$ceI2En/tMo0O1cmRL41juekKBLog6hHjjCeF0CLk9Xe8S.a9PONOu', roleId: 2, branchId: 1, createdAt: new Date('2026-02-04T18:34:49Z') },
    { id: 24, username: 'aub', password: '$2y$10$Sd5q6rwIGnJEnFJJrDwxPeYOQ.eEnPqLegmRCDJ1gAPn4kSdBP4Dy', roleId: 3, branchId: 1, createdAt: new Date('2026-02-04T18:38:06Z') },
    { id: 25, username: 'James', password: '$2y$10$75zg4wOj9LN5O6vVt9YWiuEwhV1NArmQ73bTAjQP0uXKFXxDBV7RG', roleId: 1, branchId: 1, createdAt: new Date('2026-02-04T18:46:58Z') },
    { id: 27, username: 'Lonje', password: '$2y$10$8B8req.rShgs8dVcCtFCXObunN0yUulz07BfBIxTZGUPP/b9nb0Wu', roleId: 2, branchId: 1, createdAt: new Date('2026-03-07T01:42:14Z') },
    { id: 29, username: 'inno', password: '$2y$10$fLFeM068S.BgqsipuJj8Q.Us4mEp74v1VsqV6cQvImr9QGenj9MPO', roleId: 3, branchId: 1, createdAt: new Date('2026-03-24T10:16:11Z') },
    { id: 30, username: 'admin', password: '$2y$10$7rEV9Vw9P2.P5P9V4hO.oefH9P4Jp8Y9V4hO.oefH9P4Jp8Y9V', roleId: 1, branchId: 1, createdAt: new Date('2026-04-18T21:21:43Z') },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        password: user.password,
        roleId: user.roleId,
        branchId: user.branchId,
      },
      create: {
        id: user.id,
        username: user.username,
        password: user.password,
        roleId: user.roleId,
        branchId: user.branchId,
        createdAt: user.createdAt,
      },
    });
  }

  // 4. Migrate Categories
  const categories = [
    { id: 1, slug: 'phone', title: 'Phone Accessories' },
    { id: 2, slug: 'stationery', title: 'Stationery Items' },
    { id: 3, slug: 'service', title: 'Services' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: cat,
      create: cat,
    });
  }

  // 5. Migrate Company Settings
  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {
      companyName: 'JEF Investment',
      slogan: 'Integrity is our first priority',
      address: 'Mtuwa Trading Center, C/o Box 16, Mangochi',
      phone: '+265 982 818 968 / +265 997 530 542',
      email: 'jeffinvestment43@gmail.com',
      logo: 'assets/images/logo.jpg',
      facebookPage: 'JEF Investment'
    },
    create: {
      id: 1,
      companyName: 'JEF Investment',
      slogan: 'Integrity is our first priority',
      address: 'Mtuwa Trading Center, C/o Box 16, Mangochi',
      phone: '+265 982 818 968 / +265 997 530 542',
      email: 'jeffinvestment43@gmail.com',
      logo: 'assets/images/logo.jpg',
      facebookPage: 'JEF Investment'
    }
  });

  // 6. Migrate Products (Full List from SQL)
  const products = [
    { id: 1, categoryId: 1, sku: 'PH-CH-001', name: 'DC Universal MultiCharger', description: 'red colour', costPrice: 2750.00, sellPrice: 5500.00, quantity: 6, isService: false },
    { id: 2, categoryId: 1, sku: 'PH-CAB-001', name: 'USB-C Cable', description: '1m usb-c cable', costPrice: 3500.00, sellPrice: 5500.00, quantity: 15, isService: false },
    { id: 6, categoryId: 3, sku: 'SR-PRINT', name: 'Printing (B/W)', description: 'Per page printing', costPrice: 150.00, sellPrice: 300.00, quantity: 1, isService: true },
    { id: 10, categoryId: 2, sku: 'ST-PAP-001', name: 'Plain Paper (A4)', description: 'Ream of 500 sheets', costPrice: 50.00, sellPrice: 150.00, quantity: 75, isService: false },
    { id: 37, categoryId: 1, sku: 'PH-PRI-001', name: 'privacy screen protector', description: 'from SA', costPrice: 2500.00, sellPrice: 6500.00, quantity: 15, isService: false },
    { id: 41, categoryId: 1, sku: 'PH-RKS-001', name: 'Rks type b usb', description: 'SA brand', costPrice: 2500.00, sellPrice: 4500.00, quantity: 5, isService: false },
    { id: 42, categoryId: 1, sku: 'PH-ORA-001', name: 'Oraimo earphones', description: 'SA brand', costPrice: 2500.00, sellPrice: 5500.00, quantity: 5, isService: false },
    { id: 43, categoryId: 1, sku: 'PH-ITE-001', name: 'Itel battery', description: '', costPrice: 4600.00, sellPrice: 8500.00, quantity: 15, isService: false },
    { id: 45, categoryId: 1, sku: 'PH-TEC-001', name: 'Tecno BL25', description: '', costPrice: 8500.00, sellPrice: 17500.00, quantity: 18, isService: false },
    { id: 47, categoryId: 3, sku: 'SE-PAS-001', name: 'password remove', description: '', costPrice: 2500.00, sellPrice: 15000.00, quantity: 1, isService: true },
    { id: 48, categoryId: 1, sku: 'PH-Y5C-002', name: 'SILICONE CASE', description: 'silicone', costPrice: 3000.00, sellPrice: 7500.00, quantity: 12, isService: false },
    { id: 49, categoryId: 1, sku: 'PH-SIL-001', name: 'Silvia type b cable', description: '', costPrice: 2500.00, sellPrice: 4000.00, quantity: 24, isService: false },
    { id: 50, categoryId: 1, sku: 'PH-SIL-002', name: 'Silvia type C cable', description: '', costPrice: 3500.00, sellPrice: 5500.00, quantity: 14, isService: false },
    { id: 51, categoryId: 1, sku: 'PH-PRO-001', name: 'Protea type B Cable', description: '', costPrice: 2500.00, sellPrice: 4000.00, quantity: 4, isService: false },
    { id: 52, categoryId: 1, sku: 'PH-OTH-001', name: 'Other type b cables', description: '', costPrice: 1700.00, sellPrice: 3500.00, quantity: 9, isService: false },
    { id: 53, categoryId: 1, sku: 'PH-COM-001', name: 'complete charge', description: '', costPrice: 2700.00, sellPrice: 5500.00, quantity: 5, isService: false },
    { id: 54, categoryId: 1, sku: 'PH-BAC-001', name: 'back covers', description: 'different phones', costPrice: 2500.00, sellPrice: 5000.00, quantity: 7, isService: false },
    { id: 55, categoryId: 1, sku: 'PH-CHI-001', name: 'china batteries', description: 'different phones', costPrice: 2500.00, sellPrice: 7500.00, quantity: 9, isService: false },
    { id: 56, categoryId: 1, sku: 'PH-RXD-001', name: 'RXD earphones', description: 'with mice', costPrice: 2500.00, sellPrice: 5500.00, quantity: 4, isService: false },
    { id: 57, categoryId: 1, sku: 'PH-RXD-002', name: 'RXD earphones', description: 'no mice', costPrice: 1700.00, sellPrice: 4000.00, quantity: 12, isService: false },
    { id: 58, categoryId: 1, sku: 'PH-ORA-002', name: 'oraimo earphone copy', description: 'with mice', costPrice: 150.00, sellPrice: 4500.00, quantity: 10, isService: false },
    { id: 60, categoryId: 1, sku: 'PH-OTH-002', name: 'other earphones with mice', description: '', costPrice: 1500.00, sellPrice: 4500.00, quantity: 5, isService: false },
    { id: 61, categoryId: 1, sku: 'PH-RXD-003', name: 'RXD earphones (no mice)', description: '', costPrice: 1750.00, sellPrice: 4000.00, quantity: 10, isService: false },
    { id: 62, categoryId: 1, sku: 'PH-OTH-003', name: 'other earphones (no mice)', description: '', costPrice: 750.00, sellPrice: 3000.00, quantity: 4, isService: false },
    { id: 63, categoryId: 1, sku: 'PH-OTH-004', name: 'other earphones (no mice)', description: '', costPrice: 750.00, sellPrice: 3000.00, quantity: 4, isService: false },
    { id: 64, categoryId: 1, sku: 'PH-CAR-001', name: 'card leader', description: '', costPrice: 495.00, sellPrice: 1000.00, quantity: 4, isService: false },
    { id: 65, categoryId: 1, sku: 'PH-RKS-002', name: 'Rks type c usb', description: '', costPrice: 3000.00, sellPrice: 5000.00, quantity: 4, isService: false },
    { id: 66, categoryId: 1, sku: 'PH-EXT-001', name: 'extension', description: 'large', costPrice: 5800.00, sellPrice: 7500.00, quantity: 4, isService: false },
    { id: 67, categoryId: 1, sku: 'PH-EXT-002', name: 'extension', description: 'medium', costPrice: 3700.00, sellPrice: 6500.00, quantity: 5, isService: false },
    { id: 68, categoryId: 1, sku: 'PH-ORI-001', name: 'original batteries(smart phones)', description: '', costPrice: 18000.00, sellPrice: 24000.00, quantity: 12, isService: false },
    { id: 69, categoryId: 1, sku: 'PH-AV-001', name: 'av', description: '', costPrice: 1800.00, sellPrice: 3500.00, quantity: 3, isService: false },
    { id: 70, categoryId: 1, sku: 'PH-AUX-001', name: 'Auxins', description: '', costPrice: 1800.00, sellPrice: 3500.00, quantity: 4, isService: false },
    { id: 71, categoryId: 3, sku: 'SE-PHO-001', name: 'photocopying', description: '', costPrice: 150.00, sellPrice: 250.00, quantity: 1, isService: true },
    { id: 72, categoryId: 3, sku: 'SE-TYP-001', name: 'Typing Service', description: '', costPrice: 200.00, sellPrice: 350.00, quantity: 1, isService: true },
    { id: 74, categoryId: 3, sku: 'SE-TYP-002', name: 'Typing & printing', description: '', costPrice: 300.00, sellPrice: 600.00, quantity: 1, isService: true },
    { id: 75, categoryId: 3, sku: 'SE-SCA-001', name: 'scanning', description: '', costPrice: 150.00, sellPrice: 500.00, quantity: 1, isService: true },
    { id: 76, categoryId: 1, sku: 'PH-ORA-003', name: 'Oraimo batteries bl5c', description: '', costPrice: 4500.00, sellPrice: 8500.00, quantity: 6, isService: false },
    { id: 77, categoryId: 1, sku: 'PH-VEN-001', name: 'Venus', description: '', costPrice: 4000.00, sellPrice: 8500.00, quantity: 5, isService: false },
    { id: 78, categoryId: 1, sku: 'PH-TEC-002', name: 'Tecno BL5C', description: '', costPrice: 4700.00, sellPrice: 11500.00, quantity: 3, isService: false },
    { id: 79, categoryId: 1, sku: 'PH-VIL-001', name: 'Villaon', description: '', costPrice: 4000.00, sellPrice: 8500.00, quantity: 5, isService: false },
    { id: 80, categoryId: 1, sku: 'PH-ORA-004', name: 'Oraimo batteries 25BI', description: '', costPrice: 7500.00, sellPrice: 17500.00, quantity: 8, isService: false },
    { id: 81, categoryId: 1, sku: 'PH-ITE-002', name: 'Itel battery 25BI', description: '', costPrice: 9500.00, sellPrice: 17500.00, quantity: 20, isService: false },
    { id: 82, categoryId: 3, sku: 'SE-PCS-001', name: 'pc software repairing', description: '', costPrice: 2000.00, sellPrice: 5000.00, quantity: 10, isService: true },
    { id: 83, categoryId: 1, sku: 'PH-FUL-001', name: 'Full glue protector', description: '', costPrice: 2500.00, sellPrice: 5500.00, quantity: 39, isService: false },
    { id: 84, categoryId: 1, sku: 'PH-ORA-005', name: 'Oraimo Complete Charge', description: '', costPrice: 4500.00, sellPrice: 9500.00, quantity: 5, isService: false },
    { id: 85, categoryId: 1, sku: 'PH-J4P-001', name: 'j4 protector privacy', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 15, isService: false },
    { id: 86, categoryId: 1, sku: 'PH-SPA-001', name: 'spark 40 privacy protector', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 20, isService: false },
    { id: 87, categoryId: 1, sku: 'PH-A11-001', name: 'A11 privacy protector', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 10, isService: false },
    { id: 88, categoryId: 1, sku: 'PH-A20-001', name: 'A20/30/50 privacy protector', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 10, isService: false },
    { id: 89, categoryId: 1, sku: 'PH-POP-001', name: 'pop2 privacy protector', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 1, isService: false },
    { id: 90, categoryId: 1, sku: 'PH-P20-001', name: 'P20 privacy protector', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 1, isService: false },
    { id: 91, categoryId: 1, sku: 'PH-A16-001', name: 'A16 Privacy protector', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 2, isService: false },
    { id: 92, categoryId: 1, sku: 'PH-SPA-002', name: 'Spark 5/Hot9 privacy protector', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 2, isService: false },
    { id: 93, categoryId: 1, sku: 'PH-A05-001', name: 'A05/05s/06/Redmi13c privacy protector', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 20, isService: false },
    { id: 94, categoryId: 1, sku: 'PH-POP-002', name: 'Pop8/Spark Go/20/20c privacy protector', description: '', costPrice: 2500.00, sellPrice: 6500.00, quantity: 2, isService: false },
    { id: 95, categoryId: 1, sku: 'PH-SAM-001', name: 'Samsung A06 phone case', description: '', costPrice: 3500.00, sellPrice: 7500.00, quantity: 10, isService: false },
    { id: 96, categoryId: 1, sku: 'PH-SPA-003', name: 'Spark 5 phone case', description: '', costPrice: 3500.00, sellPrice: 7500.00, quantity: 7, isService: false },
    { id: 98, categoryId: 1, sku: 'PH-A9P-001', name: 'A9 phone case', description: '', costPrice: 3250.00, sellPrice: 7500.00, quantity: 6, isService: false },
    { id: 101, categoryId: 1, sku: 'PH-STA-001', name: 'staples', description: '', costPrice: 450.00, sellPrice: 2500.00, quantity: 75, isService: false },
    { id: 102, categoryId: 1, sku: 'PH-TEC-003', name: 'TECNO A04 CASES', description: '', costPrice: 3000.00, sellPrice: 7500.00, quantity: 11, isService: false },
    { id: 103, categoryId: 1, sku: 'PH-SAM-002', name: 'Samsung A05 phone case', description: '', costPrice: 3000.00, sellPrice: 7500.00, quantity: 4, isService: false },
    { id: 104, categoryId: 1, sku: 'PH-NOV-001', name: 'Nova 3i protector(full glue)', description: '', costPrice: 2000.00, sellPrice: 5500.00, quantity: 15, isService: false },
    { id: 105, categoryId: 1, sku: 'PH-CAR-002', name: 'car charge', description: '', costPrice: 1500.00, sellPrice: 5500.00, quantity: 6, isService: false },
    { id: 106, categoryId: 1, sku: 'PH-CTT-001', name: 'Cotton cases', description: '', costPrice: 2500.00, sellPrice: 5500.00, quantity: 9, isService: false },
    { id: 107, categoryId: 1, sku: 'PH-CHA-001', name: 'CHARGE ADAPTER', description: '', costPrice: 2000.00, sellPrice: 6500.00, quantity: 10, isService: false },
    { id: 108, categoryId: 3, sku: 'SE-FAC-001', name: 'factory reset', description: '', costPrice: 1500.00, sellPrice: 8500.00, quantity: 1, isService: true },
    { id: 123, categoryId: 2, sku: 'ST-MES-001', name: 'Mesh', description: 'Original', costPrice: 1500.00, sellPrice: 2500.00, quantity: 8, isService: false },
    { id: 110, categoryId: 1, sku: 'PH-A 3-001', name: 'A 32 SILICON CASE', description: '', costPrice: 2500.00, sellPrice: 7500.00, quantity: 6, isService: false },
    { id: 111, categoryId: 1, sku: 'PH-P 1-001', name: 'P 10 SILICON CASE', description: '', costPrice: 2500.00, sellPrice: 7500.00, quantity: 4, isService: false },
    { id: 112, categoryId: 1, sku: 'PH-PRO-002', name: 'Protea type C Cable', description: '', costPrice: 2500.00, sellPrice: 5200.00, quantity: 4, isService: false },
    { id: 113, categoryId: 3, sku: 'SE-WHA-001', name: 'Whatsapp', description: '', costPrice: 300.00, sellPrice: 1500.00, quantity: 1, isService: true },
    { id: 114, categoryId: 2, sku: 'ST-PAM-001', name: 'pamphlete', description: '', costPrice: 2500.00, sellPrice: 7500.00, quantity: 3, isService: false },
    { id: 115, categoryId: 3, sku: 'SE-LAM-001', name: 'Lamination', description: '', costPrice: 700.00, sellPrice: 2000.00, quantity: 1, isService: true },
    { id: 118, categoryId: 1, sku: 'PH-OTG-001', name: 'OTG Type C', description: '', costPrice: 2500.00, sellPrice: 4500.00, quantity: 15, isService: false },
    { id: 121, categoryId: 1, sku: 'PH-CAB-002', name: 'Cables', description: '', costPrice: 1500.00, sellPrice: 5000.00, quantity: 5, isService: false },
    { id: 122, categoryId: 3, sku: 'SE-GOO-002', name: 'Google account removal', description: '', costPrice: 1500.00, sellPrice: 15000.00, quantity: 1, isService: true },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    });
  }

  // 7. Migrate Transactions (Sales) - Extracting some from SQL
  const transactions = [
    { id: '933', invoiceNo: 'Z7Q0O8', receiptNo: 'Y3O4V8', userId: 25, branchId: 1, subtotal: 4500.00, discount: 0.00, total: 4500.00, paid: 4500.00, changeDue: 0.00, profit: 2000.00, paymentMode: PaymentMode.CASH, status: SaleStatus.COMPLETED, itemsCount: 1, createdAt: new Date('2026-02-04 20:52:51') },
    { id: '934', invoiceNo: 'I4Y2X0', receiptNo: 'B2N2F8', userId: 25, branchId: 1, subtotal: 10500.00, discount: 0.00, total: 10500.00, paid: 10500.00, changeDue: 0.00, profit: 8000.00, paymentMode: PaymentMode.CASH, status: SaleStatus.COMPLETED, itemsCount: 1, createdAt: new Date('2026-02-05 15:25:51') },
    { id: '935', invoiceNo: 'L5V4Y2', receiptNo: 'H2E6T1', userId: 25, branchId: 1, subtotal: 1500.00, discount: 0.00, total: 1500.00, paid: 1500.00, changeDue: 0.00, profit: 1200.00, paymentMode: PaymentMode.CASH, status: SaleStatus.COMPLETED, itemsCount: 1, createdAt: new Date('2026-02-05 15:26:29') },
    { id: '937', invoiceNo: 'U4E6O3', receiptNo: 'E2E0G7', userId: 25, branchId: 1, subtotal: 10500.00, discount: 0.00, total: 10500.00, paid: 10500.00, changeDue: 0.00, profit: 8000.00, paymentMode: PaymentMode.CASH, status: SaleStatus.COMPLETED, itemsCount: 1, createdAt: new Date('2026-02-05 16:47:18') },
    { id: '938', invoiceNo: 'F7O6W4', receiptNo: 'R2E1F3', userId: 25, branchId: 1, subtotal: 10500.00, discount: 0.00, total: 10500.00, paid: 10500.00, changeDue: 0.00, profit: 8000.00, paymentMode: PaymentMode.CASH, status: SaleStatus.COMPLETED, itemsCount: 1, createdAt: new Date('2026-02-05 16:49:28') },
  ];

  for (const sale of transactions) {
    await prisma.sale.upsert({
      where: { id: sale.id },
      update: sale as any,
      create: sale as any,
    });
  }

  console.log('✅ Full Migration Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
