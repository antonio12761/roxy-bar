#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Color replacement mappings
const colorReplacements = [
  // Amber colors
  { from: 'text-white/70', to: 'text-white/70' },
  { from: 'text-white/80', to: 'text-white/80' },
  { from: 'text-white/90', to: 'text-white/90' },
  { from: 'bg-white/10', to: 'bg-white/10' },
  { from: 'bg-white/15', to: 'bg-white/15' },
  { from: 'bg-white/20', to: 'bg-white/20' },
  { from: 'border-white/20', to: 'border-white/20' },
  { from: 'hover:bg-white/25', to: 'hover:bg-white/25' },
  { from: 'from-white/10', to: 'from-white/10' },
  { from: 'to-white/20', to: 'to-white/20' },
  
  // Green colors
  { from: 'text-white/60', to: 'text-white/60' },
  { from: 'text-white/70', to: 'text-white/70' },
  { from: 'bg-white/8', to: 'bg-white/8' },
  { from: 'bg-white/10', to: 'bg-white/10' },
  { from: 'border-white/15', to: 'border-white/15' },
  
  // Red colors
  { from: 'text-white/50', to: 'text-white/50' },
  { from: 'text-white/60', to: 'text-white/60' },
  { from: 'bg-white/5', to: 'bg-white/5' },
  { from: 'bg-white/8', to: 'bg-white/8' },
  { from: 'border-white/10', to: 'border-white/10' },
  
  // Blue colors
  { from: 'text-white/60', to: 'text-white/60' },
  { from: 'text-white/70', to: 'text-white/70' },
  { from: 'bg-white/8', to: 'bg-white/8' },
  { from: 'bg-white/10', to: 'bg-white/10' },
  { from: 'border-white/15', to: 'border-white/15' },
  
  // Yellow colors
  { from: 'text-white/60', to: 'text-white/60' },
  { from: 'text-white/70', to: 'text-white/70' },
  { from: 'bg-white/8', to: 'bg-white/8' },
  { from: 'bg-white/10', to: 'bg-white/10' },
  { from: 'border-white/15', to: 'border-white/15' },
];

// Function to recursively find all .ts and .tsx files
function findTsFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other common directories
      if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item)) {
        findTsFiles(fullPath, files);
      }
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Function to replace colors in a file
function replaceColorsInFile(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;
    let hasChanges = false;
    
    // Apply all replacements
    for (const replacement of colorReplacements) {
      // Create a regex that matches the class name with word boundaries
      // This ensures we only match complete class names
      const regex = new RegExp(`\\b${replacement.from}\\b`, 'g');
      const newContent = content.replace(regex, replacement.to);
      
      if (newContent !== content) {
        hasChanges = true;
        content = newContent;
      }
    }
    
    // Write back if there were changes
    if (hasChanges) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Updated: ${filePath}`);
      
      // Show what was replaced
      const changedClasses = colorReplacements.filter(r => {
        const regex = new RegExp(`\\b${r.from}\\b`);
        return regex.test(originalContent);
      });
      
      changedClasses.forEach(change => {
        console.log(`   ${change.from} → ${change.to}`);
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return false;
  }
}

// Main execution
function main() {
  console.log('🎨 Starting color replacement...\n');
  
  const projectRoot = process.cwd();
  const files = findTsFiles(projectRoot);
  
  console.log(`Found ${files.length} TypeScript/TSX files\n`);
  
  let updatedCount = 0;
  
  for (const file of files) {
    if (replaceColorsInFile(file)) {
      updatedCount++;
    }
  }
  
  console.log(`\n✨ Complete! Updated ${updatedCount} files.`);
}

// Run the script
main();