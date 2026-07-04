import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log(Object.keys(prisma.payslip.fields)); // Doesn't exist like this
  console.log("TypeScript compile check will reveal errors");
}
main();
