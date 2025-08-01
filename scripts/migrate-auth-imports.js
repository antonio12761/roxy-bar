const fs = require('fs');
const path = require('path');

function findFiles(dir, pattern, ignore = []) {
  const results = [];
  
  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      
      // Skip ignored directories
      if (ignore.some(ign => filePath.includes(ign))) continue;
      
      if (stat.isDirectory()) {
        walk(filePath);
      } else if (pattern.test(file)) {
        results.push(filePath);
      }
    }
  }
  
  walk(dir);
  return results;
}

function migrateAuthImports() {
  console.log('Migrating auth imports to multi-tenant auth...');
  
  const rootDir = process.cwd();
  const files = findFiles(rootDir, /\.(ts|tsx)$/, ['node_modules', '.next', 'dist', '.git']);
  
  let updatedCount = 0;
  const filesNeedingManualReview = [];
  
  for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    const relativePath = path.relative(rootDir, filePath);
    
    // Skip migration script itself
    if (relativePath.includes('migrate-auth-imports')) continue;
    
    // Update imports from @/lib/auth to @/lib/auth-multi-tenant
    if (content.includes("from '@/lib/auth'") || content.includes('from "@/lib/auth"')) {
      // Simple replacement
      content = content.replace(/from ['"]@\/lib\/auth['"]/g, 'from "@/lib/auth-multi-tenant"');
      
      // Handle specific type imports
      content = content.replace(/import type \{ User \}/g, 'import type { AuthUser as User }');
      content = content.replace(/import type \{ AuthResult \}/g, 'import type { LoginResult as AuthResult }');
      
      // Handle logout rename
      content = content.replace(/import \{ ([^}]*)\blogoutUser\b([^}]*) \}/g, (match, before, after) => {
        return `import { ${before}logout as logoutUser${after} }`;
      });
      
      modified = true;
    }
    
    // Check for generateToken calls that need tenantId
    if (content.includes('generateToken(') && content.includes('auth-multi-tenant')) {
      // Look for generateToken calls with single parameter
      const singleParamMatches = content.match(/generateToken\([^,)]+\)/g);
      if (singleParamMatches) {
        filesNeedingManualReview.push({
          file: relativePath,
          reason: 'generateToken calls need tenantId parameter'
        });
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      updatedCount++;
      console.log(`✅ Updated: ${relativePath}`);
    }
  }
  
  console.log(`\n✨ Migration complete! Updated ${updatedCount} files.`);
  
  if (filesNeedingManualReview.length > 0) {
    console.log('\n⚠️  Files needing manual review:');
    filesNeedingManualReview.forEach(({ file, reason }) => {
      console.log(`  - ${file}: ${reason}`);
    });
  }
}

migrateAuthImports();