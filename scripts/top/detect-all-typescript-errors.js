#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Detecting all TypeScript errors in the project...\n');

try {
  // Run TypeScript compiler in check mode
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ No TypeScript errors found!');
} catch (error) {
  const output = error.stdout?.toString() || error.toString();
  const errors = output.split('\n').filter(line => line.includes('error TS'));
  
  // Parse errors by file
  const errorsByFile = {};
  let currentFile = '';
  
  output.split('\n').forEach(line => {
    if (line.includes('.tsx:') || line.includes('.ts:')) {
      currentFile = line.split(':')[0];
      if (!errorsByFile[currentFile]) {
        errorsByFile[currentFile] = [];
      }
      errorsByFile[currentFile].push(line);
    } else if (currentFile && line.trim()) {
      errorsByFile[currentFile].push(line);
    }
  });
  
  // Summary
  console.log(`📊 Total TypeScript errors: ${errors.length}\n`);
  console.log('📁 Errors by file:');
  
  Object.entries(errorsByFile).forEach(([file, fileErrors]) => {
    console.log(`\n${file}: ${fileErrors.filter(e => e.includes('error TS')).length} errors`);
    fileErrors.forEach(error => console.log(`  ${error}`));
  });
  
  // Save detailed report
  const report = {
    totalErrors: errors.length,
    timestamp: new Date().toISOString(),
    errorsByFile,
    rawOutput: output
  };
  
  fs.writeFileSync(
    path.join(process.cwd(), 'typescript-errors-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n📄 Detailed report saved to typescript-errors-report.json');
}