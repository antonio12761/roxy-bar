#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Raccolta degli errori TypeScript...');

// Esegui tsc e cattura l'output
let errors = [];
try {
  execSync('npx tsc --noEmit', { encoding: 'utf8' });
} catch (error) {
  if (error.stdout) {
    errors = error.stdout.split('\n').filter(line => line.includes('error TS'));
  }
}

console.log(`📊 Trovati ${errors.length} errori TypeScript`);

// Raggruppa gli errori per file
const errorsByFile = {};
errors.forEach(error => {
  const match = error.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
  if (match) {
    const [, filePath, line, col, errorCode, message] = match;
    if (!errorsByFile[filePath]) {
      errorsByFile[filePath] = [];
    }
    errorsByFile[filePath].push({
      line: parseInt(line),
      col: parseInt(col),
      code: errorCode,
      message,
      fullError: error
    });
  }
});

// Converti in array e ordina per numero di errori
const fileList = Object.entries(errorsByFile)
  .map(([file, errors]) => ({ file, errors, count: errors.length }))
  .sort((a, b) => b.count - a.count);

// Dividi in 4 gruppi bilanciati
const groups = [[], [], [], []];
const groupCounts = [0, 0, 0, 0];

// Algoritmo greedy per bilanciare i gruppi
fileList.forEach(fileData => {
  // Trova il gruppo con meno errori
  const minIndex = groupCounts.indexOf(Math.min(...groupCounts));
  groups[minIndex].push(fileData);
  groupCounts[minIndex] += fileData.count;
});

// Salva i 4 file
for (let i = 0; i < 4; i++) {
  const groupNumber = i + 1;
  const fileName = `typescript-errors-group-${groupNumber}.json`;
  
  const groupData = {
    groupNumber,
    totalErrors: groupCounts[i],
    files: groups[i].map(({ file, errors, count }) => ({
      file,
      errorCount: count,
      errors: errors.map(e => ({
        line: e.line,
        col: e.col,
        code: e.code,
        message: e.message
      }))
    }))
  };
  
  fs.writeFileSync(fileName, JSON.stringify(groupData, null, 2));
  console.log(`📄 Creato ${fileName} con ${groupCounts[i]} errori in ${groups[i].length} file`);
}

// Crea anche un file di riepilogo
const summary = {
  totalErrors: errors.length,
  totalFiles: fileList.length,
  groups: groups.map((group, i) => ({
    groupNumber: i + 1,
    errors: groupCounts[i],
    files: group.length,
    fileList: group.map(g => g.file)
  }))
};

fs.writeFileSync('typescript-errors-summary.json', JSON.stringify(summary, null, 2));
console.log('📊 Creato typescript-errors-summary.json con il riepilogo');