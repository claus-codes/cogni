/**
 * cogniMemo: A caching layer for the cogni library.
 * Enables efficient memoization of computed values to optimize performance in dependency graphs.
 *
 * @module cogniMemo
 * @version 1.2.0
 * @author Claus Nuoskanen <claus.nuoskanen@gmail.com>
 * @see cogni
*/

import { DefaultRecord, ResultObject } from './index';

/**
 * Memoized version of cogni's 'get' function.
 * Caches and retrieves computation results based on input parameters for optimized performance.
 *
 * @template TParam - Parameter type, typically key-value pairs.
 * @template TResult - Result type, structured as key-value pairs.
 */
export type MemoizedCogniGet<
  TParam extends DefaultRecord,
  TResult extends DefaultRecord
> = (params: Partial<TParam>) => Promise<TResult[keyof TResult] | null> | TResult[keyof TResult] | null;

/**
 * Type for a memoized cogni getMany function.
 */
export type MemoizedCogniGetMany<
  TParam extends DefaultRecord,
  TResult extends DefaultRecord
> = (params: Partial<TParam>) => Promise<ResultObject<TResult> | null> | ResultObject<TResult> | null;

/**
 * Type for a key in a key-value storage.
 */
export type KeyValueStorageKey = string | number | symbol;

/**
 * Interface for a generic key-value storage mechanism.
 *
 * @template TKey - The type of keys used for storage (string, number, or symbol).
 * @template TValue - The type of values to be stored.
 */
export interface KeyValueStorage<
  TKey extends KeyValueStorageKey,
  TValue
> {
  /**
   * Sets a value for a given key in the storage.
   *
   * @param {TKey} key - The key for which to set the value.
   * @param {TValue} value - The value to store.
   * @returns {Promise<boolean> | boolean} A promise that resolves to a boolean indicating if the value was successfully set, or a boolean directly.
   */
  set(key: TKey, value: TValue): Promise<boolean> | boolean;

  /**
   * Retrieves a value for a given key from the storage.
   *
   * @param {TKey} key - The key whose value is to be retrieved.
   * @returns {Promise<TValue | null> | TValue | null} A promise that resolves to the value associated with the key, or the value directly. Returns null if the key is not found.
   */
  get(key: TKey): Promise<TValue | null> | TValue | null;
}

/**
 * In-memory storage for caching computation results.
 * Provides basic key-value storage functionalities as a caching system.
 *
 * @template TKey - Key type for storage, can be string, number, or symbol.
 * @template TValue - Type of values to be stored.
 */
export class MemoryStorage<
  TKey extends KeyValueStorageKey,
  TValue
> implements KeyValueStorage<TKey, TValue> {
  /**
   * Constructs a new instance of MemoryStrage.
   *
   * @param {Record<TKey, TValue>} [data={}] - Initial data for the memory store.
   */
  constructor(protected data: Record<TKey, TValue> = {} as Record<TKey, TValue>) {}

  /**
   * Sets a value for a given key in the store.
   *
   * @param {string} key - The key for which to set the value.
   * @param {unknown} value - The value to set in the store.
   * @returns {boolean} True if the value was successfully set, false if the value is not updated.
   */
  set(key: TKey, value: TValue): boolean {
    if (this.data[key] === value) return false;
    this.data[key] = value as TValue;
    return true;
  }

  /**
   * Retrieves a value for a given key from the store.
   *
   * @param {keyof TResult} key - The key whose value is to be retrieved.
   * @returns {TResult[keyof TResult] | null} The value associated with the key, or undefined if not found.
   */
  get(key: TKey): TValue | null {
    return this.data[key] ?? null;
  }
}

/**
 * Creates a cache key based on provided parameters and specified keys.
 * Ensures unique identification for caching purposes.
 *
 * @param params - Parameters to create the cache key from.
 * @param cacheKeys - Keys to include in generating the cache key.
 * @returns A string representing the cache key.
 */
const cacheKey = <TParam extends DefaultRecord = DefaultRecord>(params: Partial<TParam>, cacheKeys: Array<keyof TParam>): string => {
  const keys = Object
    .keys(params)
    .filter(param => cacheKeys.includes(param as keyof TParam))
    .sort();
  return keys.map(key => `${key}_${String(params[key])}`).join('-');
}

/**
 * Wraps cogni's 'get' function with a caching mechanism.
 * Caches results of computations to optimize subsequent retrievals.
 *
 * @template TParam - Type of input parameters, usually as key-value pairs.
 * @template TResult - Type of computation results, represented as key-value pairs.
 * @param get - The original cogni 'get' function.
 * @param key - Key identifying the value to cache.
 * @param cacheKeys - Keys for generating the cache key.
 * @param defaultParameters - Default parameters for the cogni computation.
 * @param storage - Storage mechanism for caching.
 * @param cacheKeyFn - Function to generate cache keys.
 * @returns A memoized version of the 'get' function.
 */
export function cogniMemoGet<
  TParam extends DefaultRecord = DefaultRecord,
  TResult extends DefaultRecord = DefaultRecord
>(
  get: <K extends keyof TResult>(
    key: K,
    param: TParam,
    results?: ResultObject<TResult>,
  ) => Promise<TResult[K]> | TResult[K],
  key: keyof TResult,
  cacheKeys: (keyof TParam)[],
  defaultParameters: Partial<TParam> = {},
  storage: KeyValueStorage<string, TResult[keyof TResult]> = new MemoryStorage(),
  cacheKeyFn: (params: Partial<TParam>, cacheKeys: Array<keyof TParam>) => string = cacheKey
): MemoizedCogniGet<TParam, TResult> {
  /**
   * Function to get a cached result or compute a new one.
   * @param {Partial<TParam>} params - The parameters to get the result for.
   * @returns {Promise<TResult[keyof TResult] | null>} A promise that resolves to the cached result or a new one.
   */
  return async (params: Partial<TParam>): Promise<TResult[keyof TResult] | null> => {
    const storageKey = cacheKeyFn(params, cacheKeys);

    // Check if the value is already cached
    const cachedValue = await storage.get(storageKey);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // Compute the value
    const computedValue = await get(key, {
      ...defaultParameters,
      ...params,
    } as TParam);

    // Cache the value
    await storage.set(storageKey, computedValue);
    return computedValue;
  }
}

/**
 * Wraps cogni's 'getMany' function with a caching mechanism.
 * Efficiently caches and retrieves multiple computation results.
 *
 * @template TParam - Type of input parameters, usually as key-value pairs.
 * @template TResult - Type of computation results, represented as key-value pairs.
 * @param getMany - The original cogni 'getMany' function.
 * @param keys - Array of keys identifying values to cache.
 * @param cacheKeys - Keys for generating the cache key.
 * @param defaultParameters - Default parameters for the cogni computation.
 * @param storage - Storage mechanism for caching.
 * @param cacheKeyFn - Function to generate cache keys.
 * @returns A memoized version of the 'getMany' function.
 */
export function cogniMemoGetMany<
  TParam extends DefaultRecord = DefaultRecord,
  TResult extends DefaultRecord = DefaultRecord
>(
  getMany: (
    keys: Array<keyof TResult>,
    param: TParam,
    results?: ResultObject<TResult>,
  ) => Promise<ResultObject<TResult>> | ResultObject<TResult>,
  keys: Array<keyof TResult>,
  cacheKeys: (keyof TParam)[],
  defaultParameters: Partial<TParam> = {},
  storage: KeyValueStorage<KeyValueStorageKey, TResult> = new MemoryStorage(),
  cacheKeyFn: (params: Partial<TParam>, cacheKeys: Array<keyof TParam>) => string = cacheKey
): MemoizedCogniGetMany<TParam, TResult> {
  /**
   * Function to get a cached result or compute a new one.
   * @param {Partial<TParam>} params - The parameters to get the result for.
   * @returns {Promise<ResultObject<TResult>>} A promise that resolves to the cached result or a new one.
   */
  return async (params: Partial<TParam>): Promise<ResultObject<TResult>> => {
    const storageKey = cacheKeyFn(params, cacheKeys);

    // Check if the value is already cached
    const cachedValue = await storage.get(storageKey);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // Compute the value
    const computedValue = await getMany(keys, {
      ...defaultParameters,
      ...params,
    } as TParam);

    // Cache the value
    await storage.set(storageKey, computedValue);
    return computedValue;
  }
}
