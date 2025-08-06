/**
 * Secure ID generation utilities using crypto
 * Replaces unsafe Math.random() usage
 */

import { randomBytes, randomUUID } from 'crypto';
import { nanoid } from 'nanoid';

/**
 * Generate a cryptographically secure random ID
 * @param length - Length of the ID (default 16 bytes = 32 hex chars)
 */
export function generateSecureId(length: number = 16): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * Generate a short, URL-safe ID using nanoid
 * @param size - Size of the ID (default 21 chars)
 */
export function generateShortId(size: number = 21): string {
  return nanoid(size);
}

/**
 * Generate a prefixed ID (e.g., "order_abc123")
 * @param prefix - Prefix for the ID
 * @param length - Length of the random part
 */
export function generatePrefixedId(prefix: string, length: number = 12): string {
  const id = randomBytes(length).toString('hex');
  return `${prefix}_${id}`;
}

/**
 * Generate a timestamp-based ID with random suffix
 * Useful for sortable IDs
 */
export function generateTimestampId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return `${timestamp}_${random}`;
}

/**
 * Generate a secure integer within range
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 */
export function generateSecureInt(min: number, max: number): number {
  if (min >= max) {
    throw new Error('Min must be less than max');
  }
  
  const range = max - min;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValue = Math.pow(256, bytesNeeded);
  const threshold = maxValue - (maxValue % range);
  
  let randomValue: number;
  
  do {
    const bytes = randomBytes(bytesNeeded);
    randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      randomValue = randomValue * 256 + bytes[i];
    }
  } while (randomValue >= threshold);
  
  return min + (randomValue % range);
}

/**
 * Generate a secure random float between 0 and 1
 */
export function generateSecureFloat(): number {
  // Use 6 bytes for precision
  const bytes = randomBytes(6);
  let value = 0;
  
  for (let i = 0; i < 6; i++) {
    value = value * 256 + bytes[i];
  }
  
  // Normalize to 0-1
  return value / Math.pow(256, 6);
}

/**
 * Generate a secure token for authentication
 * @param length - Length in bytes (default 32 = 256 bits)
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Generate a numeric code (e.g., for OTP)
 * @param digits - Number of digits (default 6)
 */
export function generateNumericCode(digits: number = 6): string {
  const max = Math.pow(10, digits);
  const num = generateSecureInt(0, max);
  return num.toString().padStart(digits, '0');
}

/**
 * Generate a human-readable code (e.g., "ABC-123-XYZ")
 * @param pattern - Pattern string where X = letter, 9 = digit, - = separator
 */
export function generateReadableCode(pattern: string = 'XXX-999-XXX'): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  
  let result = '';
  
  for (const char of pattern) {
    switch (char) {
      case 'X':
        result += letters[generateSecureInt(0, letters.length)];
        break;
      case '9':
        result += digits[generateSecureInt(0, digits.length)];
        break;
      default:
        result += char;
    }
  }
  
  return result;
}

/**
 * Legacy compatibility wrapper - DO NOT USE IN NEW CODE
 * @deprecated Use generateSecureId() instead
 */
export function generateLegacyId(): string {
  console.warn('generateLegacyId is deprecated. Use generateSecureId() instead.');
  return `${Date.now()}_${generateSecureId(8)}`;
}

// Export convenience functions for common use cases
export const orderId = () => generatePrefixedId('ord', 16);
export const notificationId = () => generatePrefixedId('notif', 16);
export const sessionId = () => generatePrefixedId('sess', 24);
export const clientId = () => generatePrefixedId('client', 16);
export const transactionId = () => generatePrefixedId('tx', 20);

// Type definitions for ID types
export type SecureId = string;
export type UUID = string;
export type ShortId = string;
export type Token = string;

// Validation functions
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function isValidHexId(id: string, length?: number): boolean {
  const hexRegex = /^[0-9a-f]+$/i;
  if (!hexRegex.test(id)) return false;
  if (length && id.length !== length * 2) return false;
  return true;
}