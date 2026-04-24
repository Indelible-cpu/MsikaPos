import { prisma } from './src/lib/prisma';

async function testConnection() {
  try {
    console.log('⏳ Connecting to database...');
    await prisma.$connect();
    console.log('✅ Connected successfully!');
    
    const userCount = await prisma.user.count();
    console.log(`📊 Found ${userCount} users in database.`);
    
    const branches = await prisma.branch.findMany({ take: 5 });
    console.log('🏢 Sample branches:', branches.map(b => b.name));
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
