const fs = require('fs');
const path = require('path');

// Lista delle pagine che necessitano di rendering dinamico
const dynamicPages = [
  'app/cameriere/ordini-in-corso/page.tsx',
  'app/cameriere/riepilogo-turno/page.tsx',
  'app/cameriere/richiedi-aiuto/page.tsx',
  'app/cucina/page.tsx',
  'app/cassa/page.tsx',
  'app/gestione-ordini/page.tsx',
  'app/cameriere/nuova-ordinazione/page.tsx',
  'app/cameriere/dividi-conto/page.tsx',
  'app/dashboard/statistiche/page.tsx',
  'app/prepara/page.tsx',
  'app/dashboard/products/page.tsx',
  'app/dashboard/tavoli/page.tsx',
  'app/cameriere/gestione-conti/page.tsx',
  'app/cameriere/azioni-rapide/page.tsx',
  'app/dashboard/procedures/page.tsx',
  'app/dashboard/layout.tsx',
  'app/dashboard/page.tsx',
  'app/dashboard/users/page.tsx'
];

dynamicPages.forEach(pagePath => {
  const fullPath = path.join(__dirname, '..', pagePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${pagePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if already has dynamic export
  if (content.includes("export const dynamic")) {
    console.log(`✓ Already dynamic: ${pagePath}`);
    return;
  }
  
  // Add dynamic export at the beginning of the file, after "use client" if present
  if (content.startsWith('"use client"')) {
    content = content.replace('"use client";\n', '"use client";\n\nexport const dynamic = "force-dynamic";\n');
  } else {
    content = 'export const dynamic = "force-dynamic";\n\n' + content;
  }
  
  fs.writeFileSync(fullPath, content);
  console.log(`✅ Fixed: ${pagePath}`);
});

console.log('\n✨ Dynamic pages fix completed!');