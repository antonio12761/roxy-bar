/**
 * Auto-fix utility for Decimal serialization issues
 * This provides a seamless way to fix existing server actions without major refactoring
 */

import { serializeDecimalData, SerializableData } from './decimal-serializer';

/**
 * Wrapper function that automatically fixes Decimal serialization for any function
 * Usage: const fixedFunction = autoFixDecimals(originalFunction);
 */
export function autoFixDecimals<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<SerializableData<TReturn>> {
  return async (...args: TArgs): Promise<SerializableData<TReturn>> => {
    const result = await fn(...args);
    return serializeDecimalData(result);
  };
}

/**
 * Higher-order function to automatically apply decimal serialization to server actions
 * This can be used as a decorator-like pattern
 */
export function withDecimalSerialization<TArgs extends any[], TReturn>(
  target: (...args: TArgs) => Promise<TReturn>
) {
  return autoFixDecimals(target);
}

/**
 * Batch fix utility for updating multiple server actions at once
 */
export function fixMultipleServerActions<T extends Record<string, Function>>(
  actions: T
): T {
  const fixedActions = {} as T;
  
  for (const [key, action] of Object.entries(actions)) {
    if (typeof action === 'function') {
      fixedActions[key as keyof T] = autoFixDecimals(action) as T[keyof T];
    } else {
      fixedActions[key as keyof T] = action;
    }
  }
  
  return fixedActions;
}

/**
 * Quick fix for existing server actions - can be applied with minimal code changes
 * Usage: export const getOrders = quickFixDecimals(originalGetOrders);
 */
export const quickFixDecimals = autoFixDecimals;