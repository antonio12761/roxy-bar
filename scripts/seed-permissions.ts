import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

// Definizione dei permessi base del sistema
const basePermissions = [
  // Gestione Utenti
  { code: 'users.view', name: 'Visualizza Utenti', resource: 'users', action: 'view', description: 'Permette di visualizzare la lista degli utenti' },
  { code: 'users.create', name: 'Crea Utenti', resource: 'users', action: 'create', description: 'Permette di creare nuovi utenti' },
  { code: 'users.edit', name: 'Modifica Utenti', resource: 'users', action: 'edit', description: 'Permette di modificare gli utenti esistenti' },
  { code: 'users.delete', name: 'Elimina Utenti', resource: 'users', action: 'delete', description: 'Permette di eliminare gli utenti' },
  { code: 'users.block', name: 'Blocca/Sblocca Utenti', resource: 'users', action: 'block', description: 'Permette di bloccare o sbloccare gli utenti' },
  
  // Gestione Ruoli
  { code: 'roles.view', name: 'Visualizza Ruoli', resource: 'roles', action: 'view', description: 'Permette di visualizzare i ruoli' },
  { code: 'roles.create', name: 'Crea Ruoli', resource: 'roles', action: 'create', description: 'Permette di creare nuovi ruoli' },
  { code: 'roles.edit', name: 'Modifica Ruoli', resource: 'roles', action: 'edit', description: 'Permette di modificare i ruoli esistenti' },
  { code: 'roles.delete', name: 'Elimina Ruoli', resource: 'roles', action: 'delete', description: 'Permette di eliminare i ruoli' },
  { code: 'roles.assign', name: 'Assegna Ruoli', resource: 'roles', action: 'assign', description: 'Permette di assegnare ruoli agli utenti' },
  
  // Gestione Ordini
  { code: 'orders.view', name: 'Visualizza Ordini', resource: 'orders', action: 'view', description: 'Permette di visualizzare gli ordini' },
  { code: 'orders.create', name: 'Crea Ordini', resource: 'orders', action: 'create', description: 'Permette di creare nuovi ordini' },
  { code: 'orders.edit', name: 'Modifica Ordini', resource: 'orders', action: 'edit', description: 'Permette di modificare gli ordini' },
  { code: 'orders.delete', name: 'Annulla Ordini', resource: 'orders', action: 'delete', description: 'Permette di annullare gli ordini' },
  { code: 'orders.manage_all', name: 'Gestisci Tutti gli Ordini', resource: 'orders', action: 'manage_all', description: 'Permette di gestire ordini di tutti i camerieri' },
  
  // Gestione Pagamenti
  { code: 'payments.view', name: 'Visualizza Pagamenti', resource: 'payments', action: 'view', description: 'Permette di visualizzare i pagamenti' },
  { code: 'payments.create', name: 'Crea Pagamenti', resource: 'payments', action: 'create', description: 'Permette di processare i pagamenti' },
  { code: 'payments.refund', name: 'Rimborsa Pagamenti', resource: 'payments', action: 'refund', description: 'Permette di effettuare rimborsi' },
  { code: 'payments.reports', name: 'Report Pagamenti', resource: 'payments', action: 'reports', description: 'Permette di visualizzare report dei pagamenti' },
  
  // Gestione Prodotti
  { code: 'products.view', name: 'Visualizza Prodotti', resource: 'products', action: 'view', description: 'Permette di visualizzare i prodotti' },
  { code: 'products.create', name: 'Crea Prodotti', resource: 'products', action: 'create', description: 'Permette di creare nuovi prodotti' },
  { code: 'products.edit', name: 'Modifica Prodotti', resource: 'products', action: 'edit', description: 'Permette di modificare i prodotti' },
  { code: 'products.delete', name: 'Elimina Prodotti', resource: 'products', action: 'delete', description: 'Permette di eliminare i prodotti' },
  { code: 'products.availability', name: 'Gestisci Disponibilità', resource: 'products', action: 'availability', description: 'Permette di gestire la disponibilità dei prodotti' },
  
  // Gestione Tavoli
  { code: 'tables.view', name: 'Visualizza Tavoli', resource: 'tables', action: 'view', description: 'Permette di visualizzare i tavoli' },
  { code: 'tables.manage', name: 'Gestisci Tavoli', resource: 'tables', action: 'manage', description: 'Permette di gestire i tavoli' },
  { code: 'tables.assign', name: 'Assegna Tavoli', resource: 'tables', action: 'assign', description: 'Permette di assegnare i tavoli' },
  
  // Dashboard e Statistiche
  { code: 'dashboard.view', name: 'Visualizza Dashboard', resource: 'dashboard', action: 'view', description: 'Permette di accedere alla dashboard' },
  { code: 'statistics.view', name: 'Visualizza Statistiche', resource: 'statistics', action: 'view', description: 'Permette di visualizzare le statistiche' },
  { code: 'reports.view', name: 'Visualizza Report', resource: 'reports', action: 'view', description: 'Permette di visualizzare i report' },
  { code: 'reports.export', name: 'Esporta Report', resource: 'reports', action: 'export', description: 'Permette di esportare i report' },
  
  // Accesso alle pagine/stazioni
  { code: 'page.admin', name: 'Accesso Admin', resource: 'page', action: 'admin', description: 'Permette l\'accesso all\'area amministrativa' },
  { code: 'page.cameriere', name: 'Accesso Cameriere', resource: 'page', action: 'cameriere', description: 'Permette l\'accesso all\'area cameriere' },
  { code: 'page.cucina', name: 'Accesso Cucina', resource: 'page', action: 'cucina', description: 'Permette l\'accesso alla stazione cucina' },
  { code: 'page.prepara', name: 'Accesso Prepara', resource: 'page', action: 'prepara', description: 'Permette l\'accesso alla stazione prepara' },
  { code: 'page.cassa', name: 'Accesso Cassa', resource: 'page', action: 'cassa', description: 'Permette l\'accesso alla cassa' },
  { code: 'page.supervisore', name: 'Accesso Supervisore', resource: 'page', action: 'supervisore', description: 'Permette l\'accesso all\'area supervisore' },
  { code: 'page.dashboard', name: 'Accesso Dashboard', resource: 'page', action: 'dashboard', description: 'Permette l\'accesso alla dashboard' },
  
  // Gestione Sistema
  { code: 'system.settings', name: 'Impostazioni Sistema', resource: 'system', action: 'settings', description: 'Permette di modificare le impostazioni del sistema' },
  { code: 'system.backup', name: 'Backup Sistema', resource: 'system', action: 'backup', description: 'Permette di effettuare backup del sistema' },
  { code: 'system.audit', name: 'Audit Log', resource: 'system', action: 'audit', description: 'Permette di visualizzare l\'audit log' },
];

async function seedPermissions() {
  console.log('🌱 Seeding permissions...');
  
  try {
    // Inserisci i permessi
    for (const permission of basePermissions) {
      await prisma.permission.upsert({
        where: { code: permission.code },
        update: {
          name: permission.name,
          description: permission.description,
          resource: permission.resource,
          action: permission.action,
          updatedAt: new Date()
        },
        create: {
          id: nanoid(),
          ...permission,
          updatedAt: new Date()
        }
      });
      console.log(`✅ Permission created/updated: ${permission.code}`);
    }
    
    console.log('✅ Permissions seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    throw error;
  }
}

// Crea i ruoli predefiniti per il primo tenant
async function seedDefaultRoles() {
  console.log('🌱 Seeding default roles...');
  
  try {
    // Trova il primo tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('⚠️  No tenant found. Skipping default roles.');
      return;
    }
    
    // Definisci i ruoli predefiniti con i loro permessi
    const defaultRoles = [
      {
        name: 'Super Admin',
        description: 'Accesso completo al sistema',
        permissions: basePermissions.map(p => p.code) // Tutti i permessi
      },
      {
        name: 'Manager',
        description: 'Gestione operativa del locale',
        permissions: [
          'users.view', 'users.create', 'users.edit', 'users.block',
          'orders.view', 'orders.manage_all',
          'payments.view', 'payments.reports',
          'products.view', 'products.edit', 'products.availability',
          'tables.view', 'tables.manage',
          'dashboard.view', 'statistics.view', 'reports.view', 'reports.export',
          'page.dashboard', 'page.supervisore'
        ]
      }
    ];
    
    for (const roleData of defaultRoles) {
      // Crea o aggiorna il ruolo
      const role = await prisma.customRole.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name: roleData.name
          }
        },
        update: {
          description: roleData.description,
          updatedAt: new Date()
        },
        create: {
          id: nanoid(),
          name: roleData.name,
          description: roleData.description,
          tenantId: tenant.id,
          isSystem: true,
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Role created/updated: ${roleData.name}`);
      
      // Assegna i permessi al ruolo
      for (const permissionCode of roleData.permissions) {
        const permission = await prisma.permission.findUnique({
          where: { code: permissionCode }
        });
        
        if (permission) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permission.id
              }
            },
            update: {},
            create: {
              id: nanoid(),
              roleId: role.id,
              permissionId: permission.id
            }
          });
        }
      }
      
      console.log(`✅ Permissions assigned to role: ${roleData.name}`);
    }
    
    console.log('✅ Default roles seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding default roles:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedPermissions();
    await seedDefaultRoles();
    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();