const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany();
  console.log("ROLES:", JSON.stringify(roles, null, 2));
}

main().finally(() => prisma.$disconnect());
