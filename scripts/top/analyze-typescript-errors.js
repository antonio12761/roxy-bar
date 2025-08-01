#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing TypeScript errors by category...\n');

try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ No TypeScript errors found!');
} catch (error) {
  const output = error.stdout?.toString() || error.toString();
  const lines = output.split('\n');
  
  // Categories
  const categories = {
    propertyNotExist: [],
    cannotFind: [],
    typeAssignment: [],
    implicitAny: [],
    possiblyNull: [],
    functionDeclaration: [],
    argumentCount: [],
    other: []
  };
  
  // Parse errors
  lines.forEach((line, index) => {
    if (line.includes('error TS')) {
      const errorCode = line.match(/error TS(\d+):/)?.[1];
      const file = line.split('(')[0];
      const errorMsg = line.split(': error TS' + errorCode + ': ')[1];
      
      const errorInfo = {
        file,
        line,
        errorCode,
        message: errorMsg,
        context: lines[index + 1] || ''
      };
      
      // Categorize
      if (errorCode === '2339') categories.propertyNotExist.push(errorInfo);
      else if (errorCode === '2307') categories.cannotFind.push(errorInfo);
      else if (errorCode === '2322' || errorCode === '2345') categories.typeAssignment.push(errorInfo);
      else if (errorCode === '7006') categories.implicitAny.push(errorInfo);
      else if (errorCode === '18047') categories.possiblyNull.push(errorInfo);
      else if (errorCode === '1252') categories.functionDeclaration.push(errorInfo);
      else if (errorCode === '2554') categories.argumentCount.push(errorInfo);
      else categories.other.push(errorInfo);
    }
  });
  
  // Summary
  console.log('📊 Error Summary by Category:\n');
  console.log(`Property does not exist (TS2339): ${categories.propertyNotExist.length}`);
  console.log(`Cannot find module (TS2307): ${categories.cannotFind.length}`);
  console.log(`Type assignment errors (TS2322/2345): ${categories.typeAssignment.length}`);
  console.log(`Implicit any (TS7006): ${categories.implicitAny.length}`);
  console.log(`Possibly null (TS18047): ${categories.possiblyNull.length}`);
  console.log(`Function declaration (TS1252): ${categories.functionDeclaration.length}`);
  console.log(`Argument count (TS2554): ${categories.argumentCount.length}`);
  console.log(`Other errors: ${categories.other.length}`);
  
  // Files with most errors
  const fileErrors = {};
  Object.values(categories).flat().forEach(err => {
    fileErrors[err.file] = (fileErrors[err.file] || 0) + 1;
  });
  
  console.log('\n📁 Files with most errors:');
  Object.entries(fileErrors)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([file, count]) => {
      console.log(`  ${file}: ${count} errors`);
    });
  
  // Save detailed report
  const report = {
    totalErrors: Object.values(categories).flat().length,
    timestamp: new Date().toISOString(),
    categories,
    fileErrors
  };
  
  fs.writeFileSync(
    path.join(process.cwd(), 'typescript-errors-categorized.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n📄 Detailed categorized report saved to typescript-errors-categorized.json');
}