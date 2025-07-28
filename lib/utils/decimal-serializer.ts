/**
 * Utility to automatically serialize Decimal objects to numbers
 * This prevents "Only plain objects can be passed to Client Components" errors
 */

import { Decimal } from "@prisma/client/runtime/library";

export type SerializableData<T> = T extends Decimal
  ? number
  : T extends Date
  ? string
  : T extends object
  ? { [K in keyof T]: SerializableData<T[K]> }
  : T extends (infer U)[]
  ? SerializableData<U>[]
  : T;

/**
 * Recursively converts Decimal objects to numbers and Dates to ISO strings
 * This ensures all data can be safely passed to Client Components
 */
export function serializeDecimalData<T>(data: T): SerializableData<T> {
  if (data === null || data === undefined) {
    return data as SerializableData<T>;
  }

  // Handle Decimal objects
  if (data && typeof data === 'object' && 'toNumber' in data && typeof (data as any).toNumber === 'function') {
    return (data as any).toNumber() as SerializableData<T>;
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data.toISOString() as SerializableData<T>;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => serializeDecimalData(item)) as SerializableData<T>;
  }

  // Handle objects
  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeDecimalData(value);
    }
    return result as SerializableData<T>;
  }

  // Return primitive values as-is
  return data as SerializableData<T>;
}

/**
 * Convenience function to create server actions that automatically serialize data
 */
export function createSerializableServerAction<TArgs extends any[], TReturn>(
  action: (...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<SerializableData<TReturn>> => {
    const result = await action(...args);
    return serializeDecimalData(result);
  };
}