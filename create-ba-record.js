const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createBrandAmbassadorRecord() {
  try {
    // User ID from the logs: 6bc629d5-851e-421a-84e9-112a9c7a0463
    const userId = '6bc629d5-851e-421a-84e9-112a9c7a0463';
    
    console.log('🔍 Checking if Brand Ambassador record exists...');
    
    // Check if Brand Ambassador record already exists
    const existingBA = await prisma.brandAmbassador.findFirst({
      where: {
        userId: userId,
      },
    });
    
    if (existingBA) {
      console.log('✅ Brand Ambassador record already exists:');
      console.log(`   ID: ${existingBA.id}`);
      console.log(`   Display Name: ${existingBA.displayName}`);
      console.log(`   Partner ID: ${existingBA.partnerId}`);
      console.log(`   Active: ${existingBA.isActive}`);
      return;
    }
    
    console.log('❌ Brand Ambassador record not found. Creating one...');
    
    // Create Brand Ambassador record
    const brandAmbassador = await prisma.brandAmbassador.create({
      data: {
        userId: userId,
        partnerId: 1, // Default partner
        displayName: 'JO RegAdmin', // From the user metadata
        phoneNumber: null, // Optional
        perRegistrationRateCents: 500, // 5.00 USD default
        isActive: true,
      },
    });
    
    console.log('✅ Brand Ambassador record created successfully:');
    console.log(`   ID: ${brandAmbassador.id}`);
    console.log(`   User ID: ${brandAmbassador.userId}`);
    console.log(`   Display Name: ${brandAmbassador.displayName}`);
    console.log(`   Partner ID: ${brandAmbassador.partnerId}`);
    console.log(`   Active: ${brandAmbassador.isActive}`);
    
  } catch (error) {
    console.error('❌ Error creating Brand Ambassador record:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createBrandAmbassadorRecord();
