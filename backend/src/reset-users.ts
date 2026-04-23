import { PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing transaction history, expenses, and logs...');
  
  // Clear tables that depend on Users or Branches
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.syncLog.deleteMany({});
  
  console.log('🧹 Clearing all existing users...');
  await prisma.user.deleteMany({});
  
  console.log('👥 Creating demo users...');

  const demoUsers = [
    {
      username: 'admin',
      password: 'admin123',
      role: RoleName.SUPER_ADMIN,
    },
    {
      username: 'james',
      password: 'james2025',
      role: RoleName.ADMIN,
    },
    {
      username: 'cashier',
      password: 'cashier123',
      role: RoleName.CASHIER,
    }
  ];

  // Ensure roles exist
  const rolesMap = {
    [RoleName.SUPER_ADMIN]: 'Full system access',
    [RoleName.ADMIN]: 'Administrative access',
    [RoleName.CASHIER]: 'POS operation access',
  };

  for (const [name, description] of Object.entries(rolesMap)) {
    await prisma.role.upsert({
      where: { name: name as RoleName },
      update: {},
      create: { name: name as RoleName, description }
    });
  }

  const roles = await prisma.role.findMany();
  const getRoleId = (roleName: RoleName) => roles.find(r => r.name === roleName)?.id || 1;

  // Ensure a branch exists
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    branch = await prisma.branch.create({
      data: { name: 'Main Branch', location: 'Headquarters' }
    });
  }

  for (const user of demoUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await prisma.user.create({
      data: {
        username: user.username,
        password: hashedPassword,
        roleId: getRoleId(user.role),
        branchId: branch.id,
      }
    });
    console.log(`✅ Created user: ${user.username} (Password: ${user.password})`);
  }

  console.log('✨ User reset complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
