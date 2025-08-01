#!/usr/bin/env ts-node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

async function migrateAuthImports() {
  console.log('Migrating auth imports to multi-tenant auth...');
  
  // Find all TypeScript files
  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', 'scripts/**', '.next/**', 'dist/**'],
    cwd: process.cwd()
  });
  
  let updatedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Update imports from @/lib/auth to @/lib/auth-multi-tenant
    if (content.includes("from '@/lib/auth'") || content.includes('from "@/lib/auth"')) {
      // Handle different import patterns
      content = content
        // Simple imports
        .replace(/from ['"]@\/lib\/auth['"]/g, 'from "@/lib/auth-multi-tenant"')
        // Type imports
        .replace(/import type \{ User \} from ['"]@\/lib\/auth['"]/g, 'import type { AuthUser as User } from "@/lib/auth-multi-tenant"')
        .replace(/import type \{ AuthResult \} from ['"]@\/lib\/auth['"]/g, 'import type { LoginResult as AuthResult } from "@/lib/auth-multi-tenant"')
        // Named imports
        .replace(/import \{ ([^}]+) \} from ['"]@\/lib\/auth['"]/g, (match, imports) => {
          // Map old names to new names
          const importMap: Record<string, string> = {
            'loginUser': 'loginUser',
            'logoutUser': 'logout',
            'getCurrentUser': 'getCurrentUser',
            'generateToken': 'generateToken',
            'verifyToken': 'verifyToken',
            'hasPermission': 'hasPermission',
            'requireAuth': 'requireAuth'
          };
          
          const mappedImports = imports
            .split(',')
            .map((imp: string) => {
              const trimmed = imp.trim();
              const [importName, alias] = trimmed.split(' as ').map(s => s.trim());
              
              if (importMap[importName]) {
                const newName = importMap[importName];
                if (newName !== importName) {
                  return alias ? `${newName} as ${alias}` : `${newName} as ${importName}`;
                }
                return trimmed;
              }
              return trimmed;
            })
            .join(', ');
          
          return `import { ${mappedImports} } from "@/lib/auth-multi-tenant"`;
        });
      
      // Update generateToken calls to include tenantId
      if (content.includes('generateToken(')) {
        // This is more complex and might need manual review
        console.log(`⚠️  ${file}: generateToken calls may need manual update to include tenantId`);
      }
      
      modified = true;
    }
    
    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      updatedCount++;
      console.log(`✅ Updated: ${file}`);
    }
  }
  
  console.log(`\n✨ Migration complete! Updated ${updatedCount} files.`);
  console.log('⚠️  Please review files with generateToken calls to ensure they pass tenantId as the second parameter.');
}

migrateAuthImports().catch(console.error);