import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth-multi-tenant';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Check if test tenant exists
    let tenant = await prisma.tenant.findUnique({
      where: { slug: 'bar-roxy' }
    });

    if (!tenant) {
      // Create test tenant
      tenant = await prisma.tenant.create({
        data: {
          name: 'Siplit',
          slug: 'bar-roxy',
          plan: 'BASIC',
          maxUsers: 50,
          maxTables: 30,
          maxProducts: 500
        }
      });
      console.log('✅ Created tenant:', tenant.name);
    } else {
      console.log('ℹ️  Tenant already exists:', tenant.name);
    }

    // Check if test user exists
    const existingUser = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (existingUser) {
      console.log('ℹ️  User already exists: admin');
      return;
    }

    // Create test admin user
    const hashedPassword = await hashPassword('admin123');
    
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@barroxy.it',
        password: hashedPassword,
        nome: 'Admin',
        cognome: 'System',
        ruolo: 'SUPERVISORE',
        tenantId: tenant.id,
        emailVerified: new Date(),
        attivo: true
      }
    });

    console.log('✅ Created test user:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Role: SUPERVISORE');
    console.log('   Tenant:', tenant.name);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();