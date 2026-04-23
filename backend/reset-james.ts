import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const password = 'Jmaes2025@.';
  const hash = await bcrypt.hash(password, 10);
  
  await prisma.user.update({
    where: { username: 'James' },
    data: { password: hash }
  });
  
  console.log('Password for James successfully reset to Jmaes2025@.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
