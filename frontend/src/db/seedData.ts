import type { POSDatabase } from './posDB';

export const seedCategories = [
  { id: 1, slug: 'phone', title: 'Phone Accessories' },
  { id: 2, slug: 'stationery', title: 'Stationery Items' },
  { id: 3, slug: 'service', title: 'Services' }
];

export const seedProducts = [
  { id: 1, categoryId: 1, sku: 'PH-CH-001', name: 'DC Universal MultiCharger', costPrice: 2750.00, sellPrice: 5500.00, quantity: 6, isService: false },
  { id: 2, categoryId: 1, sku: 'PH-CAB-001', name: 'USB-C Cable', costPrice: 3500.00, sellPrice: 5500.00, quantity: 15, isService: false },
  { id: 6, categoryId: 3, sku: 'SR-PRINT', name: 'Printing (B/W)', costPrice: 150.00, sellPrice: 300.00, quantity: 1, isService: true },
  { id: 10, categoryId: 2, sku: 'ST-PAP-001', name: 'Plain Paper (A4)', costPrice: 50.00, sellPrice: 150.00, quantity: 75, isService: false },
  { id: 37, categoryId: 1, sku: 'PH-PRI-001', name: 'privacy screen protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 15, isService: false },
  { id: 41, categoryId: 1, sku: 'PH-RKS-001', name: 'Rks type b usb', costPrice: 2500.00, sellPrice: 4500.00, quantity: 5, isService: false },
  { id: 42, categoryId: 1, sku: 'PH-ORA-001', name: 'Oraimo earphones', costPrice: 2500.00, sellPrice: 5500.00, quantity: 5, isService: false },
  { id: 43, categoryId: 1, sku: 'PH-ITE-001', name: 'Itel battery', costPrice: 4600.00, sellPrice: 8500.00, quantity: 15, isService: false },
  { id: 45, categoryId: 1, sku: 'PH-TEC-001', name: 'Tecno BL25', costPrice: 8500.00, sellPrice: 17500.00, quantity: 18, isService: false },
  { id: 47, categoryId: 3, sku: 'SE-PAS-001', name: 'password remove', costPrice: 2500.00, sellPrice: 15000.00, quantity: 1, isService: true },
  { id: 48, categoryId: 1, sku: 'PH-Y5C-002', name: 'SILICONE CASE', costPrice: 3000.00, sellPrice: 7500.00, quantity: 12, isService: false },
  { id: 49, categoryId: 1, sku: 'PH-SIL-001', name: 'Silvia type b cable', costPrice: 2500.00, sellPrice: 4000.00, quantity: 24, isService: false },
  { id: 50, categoryId: 1, sku: 'PH-SIL-002', name: 'Silvia type C cable', costPrice: 3500.00, sellPrice: 5500.00, quantity: 14, isService: false },
  { id: 51, categoryId: 1, sku: 'PH-PRO-001', name: 'Protea type B Cable', costPrice: 2500.00, sellPrice: 4000.00, quantity: 4, isService: false },
  { id: 52, categoryId: 1, sku: 'PH-OTH-001', name: 'Other type b cables', costPrice: 1700.00, sellPrice: 3500.00, quantity: 9, isService: false },
  { id: 53, categoryId: 1, sku: 'PH-COM-001', name: 'complete charge', costPrice: 2700.00, sellPrice: 5500.00, quantity: 5, isService: false },
  { id: 54, categoryId: 1, sku: 'PH-BAC-001', name: 'back covers', costPrice: 2500.00, sellPrice: 5000.00, quantity: 7, isService: false },
  { id: 55, categoryId: 1, sku: 'PH-CHI-001', name: 'china batteries', costPrice: 2500.00, sellPrice: 7500.00, quantity: 9, isService: false },
  { id: 56, categoryId: 1, sku: 'PH-RXD-001', name: 'RXD earphones', costPrice: 2500.00, sellPrice: 5500.00, quantity: 4, isService: false },
  { id: 57, categoryId: 1, sku: 'PH-RXD-002', name: 'RXD earphones', costPrice: 1700.00, sellPrice: 4000.00, quantity: 12, isService: false },
  { id: 58, categoryId: 1, sku: 'PH-ORA-002', name: 'oraimo earphone copy', costPrice: 1500.00, sellPrice: 4500.00, quantity: 10, isService: false },
  { id: 60, categoryId: 1, sku: 'PH-OTH-002', name: 'other earphones with mice', costPrice: 1500.00, sellPrice: 4500.00, quantity: 5, isService: false },
  { id: 61, categoryId: 1, sku: 'PH-RXD-003', name: 'RXD earphones (no mice)', costPrice: 1750.00, sellPrice: 4000.00, quantity: 10, isService: false },
  { id: 62, categoryId: 1, sku: 'PH-OTH-003', name: 'other earphones (no mice)', costPrice: 750.00, sellPrice: 3000.00, quantity: 4, isService: false },
  { id: 63, categoryId: 1, sku: 'PH-OTH-004', name: 'other earphones (no mice)', costPrice: 750.00, sellPrice: 3000.00, quantity: 4, isService: false },
  { id: 64, categoryId: 1, sku: 'PH-CAR-001', name: 'card leader', costPrice: 495.00, sellPrice: 1000.00, quantity: 4, isService: false },
  { id: 65, categoryId: 1, sku: 'PH-RKS-002', name: 'Rks type c usb', costPrice: 3000.00, sellPrice: 5000.00, quantity: 4, isService: false },
  { id: 66, categoryId: 1, sku: 'PH-EXT-001', name: 'extension', costPrice: 5800.00, sellPrice: 7500.00, quantity: 4, isService: false },
  { id: 67, categoryId: 1, sku: 'PH-EXT-002', name: 'extension', costPrice: 3700.00, sellPrice: 6500.00, quantity: 5, isService: false },
  { id: 68, categoryId: 1, sku: 'PH-ORI-001', name: 'original batteries(smart phones)', costPrice: 18000.00, sellPrice: 24000.00, quantity: 12, isService: false },
  { id: 69, categoryId: 1, sku: 'PH-AV-001', name: 'av', costPrice: 1800.00, sellPrice: 3500.00, quantity: 3, isService: false },
  { id: 70, categoryId: 1, sku: 'PH-AUX-001', name: 'Auxins', costPrice: 1800.00, sellPrice: 3500.00, quantity: 4, isService: false },
  { id: 71, categoryId: 3, sku: 'SE-PHO-001', name: 'photocopying', costPrice: 150.00, sellPrice: 250.00, quantity: 1, isService: true },
  { id: 72, categoryId: 3, sku: 'SE-TYP-001', name: 'Typing Service', costPrice: 200.00, sellPrice: 350.00, quantity: 1, isService: true },
  { id: 74, categoryId: 3, sku: 'SE-TYP-002', name: 'Typing & printing', costPrice: 300.00, sellPrice: 600.00, quantity: 1, isService: true },
  { id: 75, categoryId: 3, sku: 'SE-SCA-001', name: 'scanning', costPrice: 150.00, sellPrice: 500.00, quantity: 1, isService: true },
  { id: 76, categoryId: 1, sku: 'PH-ORA-003', name: 'Oraimo batteries bl5c', costPrice: 4500.00, sellPrice: 8500.00, quantity: 6, isService: false },
  { id: 77, categoryId: 1, sku: 'PH-VEN-001', name: 'Venus', costPrice: 4000.00, sellPrice: 8500.00, quantity: 5, isService: false },
  { id: 78, categoryId: 1, sku: 'PH-TEC-002', name: 'Tecno BL5C', costPrice: 4700.00, sellPrice: 11500.00, quantity: 3, isService: false },
  { id: 79, categoryId: 1, sku: 'PH-VIL-001', name: 'Villaon', costPrice: 4000.00, sellPrice: 8500.00, quantity: 5, isService: false },
  { id: 80, categoryId: 1, sku: 'PH-ORA-004', name: 'Oraimo batteries 25BI', costPrice: 7500.00, sellPrice: 17500.00, quantity: 8, isService: false },
  { id: 81, categoryId: 1, sku: 'PH-ITE-002', name: 'Itel battery 25BI', costPrice: 9500.00, sellPrice: 17500.00, quantity: 20, isService: false },
  { id: 82, categoryId: 3, sku: 'SE-PCS-001', name: 'pc software repairing', costPrice: 2000.00, sellPrice: 5000.00, quantity: 10, isService: true },
  { id: 83, categoryId: 1, sku: 'PH-FUL-001', name: 'Full glue protector', costPrice: 2500.00, sellPrice: 5500.00, quantity: 39, isService: false },
  { id: 84, categoryId: 1, sku: 'PH-ORA-005', name: 'Oraimo Complete Charge', costPrice: 4500.00, sellPrice: 9500.00, quantity: 5, isService: false },
  { id: 85, categoryId: 1, sku: 'PH-J4P-001', name: 'j4 protector privacy', costPrice: 2500.00, sellPrice: 6500.00, quantity: 15, isService: false },
  { id: 86, categoryId: 1, sku: 'PH-SPA-001', name: 'spark 40 privacy protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 20, isService: false },
  { id: 87, categoryId: 1, sku: 'PH-A11-001', name: 'A11 privacy protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 10, isService: false },
  { id: 88, categoryId: 1, sku: 'PH-A20-001', name: 'A20/30/50 privacy protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 10, isService: false },
  { id: 89, categoryId: 1, sku: 'PH-POP-001', name: 'pop2 privacy protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 1, isService: false },
  { id: 90, categoryId: 1, sku: 'PH-P20-001', name: 'P20 privacy protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 1, isService: false },
  { id: 91, categoryId: 1, sku: 'PH-A16-001', name: 'A16 Privacy protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 2, isService: false },
  { id: 92, categoryId: 1, sku: 'PH-SPA-002', name: 'Spark 5/Hot9 privacy protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 2, isService: false },
  { id: 93, categoryId: 1, sku: 'PH-A05-001', name: 'A05/05s/06/Redmi13c privacy protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 20, isService: false },
  { id: 94, categoryId: 1, sku: 'PH-POP-002', name: 'Pop8/Spark Go/20/20c privacy protector', costPrice: 2500.00, sellPrice: 6500.00, quantity: 2, isService: false },
  { id: 95, categoryId: 1, sku: 'PH-SAM-001', name: 'Samsung A06 phone case', costPrice: 3500.00, sellPrice: 7500.00, quantity: 10, isService: false },
  { id: 96, categoryId: 1, sku: 'PH-SPA-003', name: 'Spark 5 phone case', costPrice: 3500.00, sellPrice: 7500.00, quantity: 7, isService: false },
  { id: 98, categoryId: 1, sku: 'PH-A9P-001', name: 'A9 phone case', costPrice: 3250.00, sellPrice: 7500.00, quantity: 6, isService: false },
  { id: 101, categoryId: 1, sku: 'PH-STA-001', name: 'staples', costPrice: 450.00, sellPrice: 2500.00, quantity: 75, isService: false },
  { id: 102, categoryId: 1, sku: 'PH-TEC-003', name: 'TECNO A04 CASES', costPrice: 3000.00, sellPrice: 7500.00, quantity: 11, isService: false },
  { id: 103, categoryId: 1, sku: 'PH-SAM-002', name: 'Samsung A05 phone case', costPrice: 3000.00, sellPrice: 7500.00, quantity: 4, isService: false },
  { id: 104, categoryId: 1, sku: 'PH-NOV-001', name: 'Nova 3i protector(full glue)', costPrice: 2000.00, sellPrice: 5500.00, quantity: 15, isService: false },
  { id: 105, categoryId: 1, sku: 'PH-CAR-002', name: 'car charge', costPrice: 1500.00, sellPrice: 5500.00, quantity: 6, isService: false },
  { id: 106, categoryId: 1, sku: 'PH-CTT-001', name: 'Cotton cases', costPrice: 2500.00, sellPrice: 5500.00, quantity: 9, isService: false },
  { id: 107, categoryId: 1, sku: 'PH-CHA-001', name: 'CHARGE ADAPTER', costPrice: 2000.00, sellPrice: 6500.00, quantity: 10, isService: false },
  { id: 108, categoryId: 3, sku: 'SE-FAC-001', name: 'factory reset', costPrice: 1500.00, sellPrice: 8500.00, quantity: 1, isService: true },
  { id: 123, categoryId: 2, sku: 'ST-MES-001', name: 'Mesh', costPrice: 1500.00, sellPrice: 2500.00, quantity: 8, isService: false },
  { id: 110, categoryId: 1, sku: 'PH-A 3-001', name: 'A 32 SILICON CASE', costPrice: 2500.00, sellPrice: 7500.00, quantity: 6, isService: false },
  { id: 111, categoryId: 1, sku: 'PH-P 1-001', name: 'P 10 SILICON CASE', costPrice: 2500.00, sellPrice: 7500.00, quantity: 4, isService: false },
  { id: 112, categoryId: 1, sku: 'PH-PRO-002', name: 'Protea type C Cable', costPrice: 2500.00, sellPrice: 5200.00, quantity: 4, isService: false },
  { id: 113, categoryId: 3, sku: 'SE-WHA-001', name: 'Whatsapp', costPrice: 300.00, sellPrice: 1500.00, quantity: 1, isService: true },
  { id: 114, categoryId: 2, sku: 'ST-PAM-001', name: 'pamphlete', costPrice: 2500.00, sellPrice: 7500.00, quantity: 3, isService: false },
  { id: 115, categoryId: 3, sku: 'SE-LAM-001', name: 'Lamination', costPrice: 700.00, sellPrice: 2000.00, quantity: 1, isService: true },
  { id: 118, categoryId: 1, sku: 'PH-OTG-001', name: 'OTG Type C', costPrice: 2500.00, sellPrice: 4500.00, quantity: 15, isService: false },
  { id: 121, categoryId: 1, sku: 'PH-CAB-002', name: 'Cables', costPrice: 1500.00, sellPrice: 5000.00, quantity: 5, isService: false },
  { id: 122, categoryId: 3, sku: 'SE-GOO-002', name: 'Google account removal', costPrice: 1500.00, sellPrice: 15000.00, quantity: 1, isService: true }
];

export const seedUsers = [
  { id: crypto.randomUUID(), username: 'superadmin', fullname: 'Super Administrator', role: 'SUPER_ADMIN', roleId: 1, phone: '0880000001', createdAt: new Date().toISOString() },
  { id: crypto.randomUUID(), username: 'admin', fullname: 'Administrator', role: 'ADMIN', roleId: 2, phone: '0880000002', createdAt: new Date().toISOString() },
  { id: crypto.randomUUID(), username: 'cashier', fullname: 'Main Cashier', role: 'CASHIER', roleId: 3, phone: '0880000003', createdAt: new Date().toISOString() }
];

export const initDB = async (db: POSDatabase) => {
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(seedCategories);
    const productsToInsert = seedProducts.map(p => ({
      ...p,
      status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    await db.products.bulkAdd(productsToInsert);
  }

  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.bulkAdd(seedUsers);
  }

  const hoursSetting = await db.settings.get('lockout_hours');
  if (!hoursSetting) {
    await db.settings.put({ key: 'lockout_hours', value: { start: '23:59', end: '06:00' } });
  }
};
