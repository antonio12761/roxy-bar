import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function seedDefaultRoles() {
  try {
    console.log('🌱 Starting default roles seed...');

    // Get a tenant ID (you should replace this with your actual tenant ID)
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.error('❌ No tenant found. Please create a tenant first.');
      return;
    }

    const defaultRoles = [
      {
        name: 'Cameriere',
        description: 'Gestisce gli ordini ai tavoli e al banco',
        permissions: ['orders.view', 'orders.create', 'orders.edit', 'products.view']
      },
      {
        name: 'Prepara',
        description: 'Gestisce la preparazione degli ordini',
        permissions: ['orders.view', 'orders.edit', 'products.view']
      },
      {
        name: 'Cassa',
        description: 'Gestisce i pagamenti e la chiusura dei conti',
        permissions: ['orders.view', 'payments.view', 'payments.process', 'reports.view']
      },
      {
        name: 'Supervisore',
        description: 'Supervisiona le operazioni e gestisce il personale',
        permissions: ['orders.view', 'orders.edit', 'orders.delete', 'users.view', 'reports.view', 'reports.export', 'products.view', 'products.edit']
      }
    ];

    for (const roleData of defaultRoles) {
      // Check if role already exists
      const existingRole = await prisma.customRole.findFirst({
        where: {
          name: roleData.name,
          tenantId: tenant.id
        }
      });

      if (existingRole) {
        console.log(`⏭️  Role "${roleData.name}" already exists, skipping...`);
        continue;
      }

      // Create the role
      const role = await prisma.customRole.create({
        data: {
          id: nanoid(),
          name: roleData.name,
          description: roleData.description,
          tenantId: tenant.id,
          isSystem: false // These are default roles but not system roles
        }
      });

      console.log(`✅ Created role: ${role.name}`);

      // Get permission IDs
      const permissions = await prisma.permission.findMany({
        where: {
          name: {
            in: roleData.permissions
          }
        }
      });

      // Create role-permission associations
      for (const permission of permissions) {
        await prisma.rolePermission.create({
          data: {
            id: nanoid(),
            roleId: role.id,
            permissionId: permission.id
          }
        });
      }

      console.log(`   ✅ Assigned ${permissions.length} permissions to ${role.name}`);
    }

    console.log('✅ Default roles seed completed!');
  } catch (error) {
    console.error('❌ Error seeding default roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed
seedDefaultRoles();