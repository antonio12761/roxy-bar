import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth-multi-tenant';

const prisma = new PrismaClient();

async function createPoskiUser() {
  try {
    // Check if tenant exists
    let tenant = await prisma.tenant.findUnique({
      where: { slug: 'bar-roxy' }
    });

    if (!tenant) {
      console.log('❌ Tenant Roxy Bar not found. Run create-test-user.ts first.');
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { username: 'Poski' }
    });

    if (existingUser) {
      console.log('ℹ️  User already exists: Poski');
      // Update tenant if needed
      if (existingUser.tenantId !== tenant.id) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { tenantId: tenant.id }
        });
        console.log('✅ Updated user tenant');
      }
      return;
    }

    // Create Poski user
    const hashedPassword = await hashPassword('123456'); // Default password
    
    const user = await prisma.user.create({
      data: {
        username: 'Poski',
        email: 'poski@barroxy.it',
        password: hashedPassword,
        nome: 'Poski',
        cognome: 'User',
        ruolo: 'SUPERVISORE',
        tenantId: tenant.id,
        emailVerified: new Date(),
        attivo: true
      }
    });

    console.log('✅ Created user:');
    console.log('   Username: Poski');
    console.log('   Password: 123456');
    console.log('   Role: SUPERVISORE');
    console.log('   Tenant:', tenant.name);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createPoskiUser();