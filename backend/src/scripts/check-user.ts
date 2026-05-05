
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findFirst({
    where: { fullname: { contains: 'James Dickson', mode: 'insensitive' } },
    include: { role: true }
  });
  console.log('User found:', JSON.stringify(user, null, 2));
  
  const productCount = await prisma.product.count({ where: { deleted: true } });
  console.log('Deleted products count:', productCount);
}

checkUser().finally(() => prisma.$disconnect());
