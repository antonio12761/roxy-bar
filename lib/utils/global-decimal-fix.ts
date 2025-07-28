/**
 * Global Decimal Serialization Fix
 * This utility patches common Prisma/Decimal serialization issues globally
 */

import { Decimal } from "@prisma/client/runtime/library";

// Store original JSON.stringify for reference
const originalStringify = JSON.stringify;

/**
 * Global JSON.stringify patch that automatically handles Decimal objects
 */
function patchedStringify(value: any, replacer?: any, space?: any): string {
  return originalStringify(value, (key, val) => {
    // Handle Decimal objects
    if (val && typeof val === 'object' && 'toNumber' in val && typeof val.toNumber === 'function') {
      return val.toNumber();
    }
    
    // Apply user's replacer if provided
    if (typeof replacer === 'function') {
      return replacer(key, val);
    } else if (Array.isArray(replacer) && typeof key === 'string') {
      return replacer.includes(key) ? val : undefined;
    }
    
    return val;
  }, space);
}

/**
 * Apply the global patch
 */
export function applyGlobalDecimalFix() {
  // Patch JSON.stringify globally
  (global as any).JSON.stringify = patchedStringify;
  
  console.log('✅ Global Decimal serialization fix applied');
}

/**
 * Remove the global patch (for testing purposes)
 */
export function removeGlobalDecimalFix() {
  (global as any).JSON.stringify = originalStringify;
  console.log('🔄 Global Decimal serialization fix removed');
}

/**
 * Check if the global fix is active
 */
export function isGlobalDecimalFixActive(): boolean {
  return (global as any).JSON.stringify === patchedStringify;
}

// Auto-apply the fix when this module is imported
if (typeof window === 'undefined') {
  // Only apply in server environment
  applyGlobalDecimalFix();
}