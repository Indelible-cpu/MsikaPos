const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixData() {
  console.log('🔍 Starting Data Audit...');

  try {
    // 1. Check for branches
    const branches = await prisma.branch.findMany();
    let defaultBranchId;

    if (branches.length === 0) {
      console.log('⚠️ No branches found. Creating default HQ branch...');
      const hq = await prisma.branch.create({
        data: {
          name: 'Head Office (HQ)',
          location: 'Default Location',
          status: 'ACTIVE'
        }
      });
      defaultBranchId = hq.id;
    } else {
      defaultBranchId = branches[0].id;
    }

    console.log(`✅ Default Branch ID: ${defaultBranchId}`);

    // 2. Fix Products
    const productsCount = await prisma.product.count({ where: { branchId: null } });
    if (productsCount > 0) {
      console.log(`📦 Fixing ${productsCount} products...`);
      await prisma.product.updateMany({
        where: { branchId: null },
        data: { branchId: defaultBranchId }
      });
    }

    // 3. Fix Sales
    const salesCount = await prisma.sale.count({ where: { branchId: null } });
    if (salesCount > 0) {
      console.log(`💰 Fixing ${salesCount} sales...`);
      await prisma.sale.updateMany({
        where: { branchId: null },
        data: { branchId: defaultBranchId }
      });
    }

    // 4. Fix Users
    const usersCount = await prisma.user.count({ where: { branchId: null } });
    if (usersCount > 0) {
      console.log(`👥 Fixing ${usersCount} users...`);
      await prisma.user.updateMany({
        where: { branchId: null },
        data: { branchId: defaultBranchId }
      });
    }

    // 5. Fix Customers
    const customersCount = await prisma.customer.count({ where: { branchId: null } });
    if (customersCount > 0) {
      console.log(`🤝 Fixing ${customersCount} customers...`);
      await prisma.customer.updateMany({
        where: { branchId: null },
        data: { branchId: defaultBranchId }
      });
    }

    // 6. Fix Expenses
    const expensesCount = await prisma.expense.count({ where: { branchId: null } });
    if (expensesCount > 0) {
      console.log(`💸 Fixing ${expensesCount} expenses...`);
      await prisma.expense.updateMany({
        where: { branchId: null },
        data: { branchId: defaultBranchId }
      });
    }

    console.log('✨ Data migration complete!');
  } catch (e) {
    console.error('❌ Data Migration Failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

fixData();
