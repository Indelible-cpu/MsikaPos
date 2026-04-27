import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const descriptions: Record<string, string> = {
  'Rks type b usb': 'High-speed RKS micro-USB cable for reliable charging and data transfer. Durable design with reinforced connectors.',
  'Rks type c usb': 'Premium RKS USB-C cable. Supports fast charging and rapid data synchronization for modern smartphones.',
  'password remove': 'Professional password removal service for smartphones and PCs. Secure, fast, and confidential handling of your device.',
  'Printing (B/W)': 'High-quality black and white printing service. Sharp text and clear graphics for your documents, reports, and assignments.',
  'photocopying': 'Fast and accurate photocopying service. Duplicate your important documents with high fidelity and speed.',
  'Typing Service': 'Professional document typing and formatting. We handle everything from simple letters to complex reports with precision.',
  'scanning': 'High-resolution digital scanning. Convert your physical documents into clear PDF or image files for easy storage.',
  'factory reset': 'Complete device restoration to original factory settings. Solves software glitches and prepares devices for new owners.',
  'Google account removal': 'Safe and effective FRP (Factory Reset Protection) removal. Regain access to your device if you\'ve forgotten your Google login.',
  'Oraimo earphones': 'Original Oraimo earphones with deep bass and crystal clear sound. Ergonomic design for maximum comfort.',
  'Itel battery': 'Long-lasting original Itel replacement battery. Restore your phone\'s battery life to peak performance.',
  'Lamination': 'Durable document lamination service. Protect your important certificates, IDs, and cards from wear, tear, and moisture.',
  'Whatsapp': 'Complete WhatsApp installation and configuration service. We help you set up accounts, back up chats, and transfer data.',
  'Mesh': 'Premium mesh office stationery for organizing your desk. Sleek metallic design for a professional workspace.',
  'Plain Paper (A4)': 'Standard high-quality A4 plain paper. Perfect for printing, drawing, and general office use.'
};

async function main() {
  console.log('🌱 Updating product descriptions...');
  
  const products = await prisma.product.findMany();
  
  for (const product of products) {
    const desc = descriptions[product.name];
    if (desc) {
      await prisma.product.update({
        where: { id: product.id },
        data: { description: desc }
      });
      console.log(`✅ Updated: ${product.name}`);
    }
  }
  
  console.log('🚀 All descriptions updated successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
