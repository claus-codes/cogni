/**
 * Cogni: A library for managing computed values and their dependencies.
 *
 * @copyright 2023 Claus Nuoskanen
 * @author Claus Nuoskanen <claus.nuoskanen@gmail.com>
*/
import { CogniInterface, DefaultRecord } from '../types';
import { CogniStoreInteraface } from './types';
/**
 * CogniStore: A class that acts as a centralized manager for caching computation results.
 * It supports various storage strategies, enhancing performance by reducing redundant computations.
 * Utilizes a pluggable storage mechanism to accommodate different caching needs.
 *
 * @template TParam - Type of parameters used in computation functions.
 * @template TResult - Type of results expected from computation functions.
 */
declare class CogniStore<TParam extends Record<string, any> = DefaultRecord, TResult extends Record<string, any> = DefaultRecord> {
    protected readonly cogni: CogniInterface<TParam, TResult>;
    protected readonly cacheKeys: (keyof TParam)[];
    protected readonly defaultParameters: Partial<TParam>;
    /**
     * Collection of storage instances for caching computed values.
     * These storages can be customized to suit various caching strategies.
     */
    protected storages: CogniStoreInteraface<TParam, TResult>[];
    /**
     * Constructs a CogniStore instance, initializing it with a computation context and cache key management.
     * Throws an error if cache keys are not provided, ensuring proper cache key setup.
     *
     * @param cogni - Instance of Cogni for computation purposes.
     * @param cacheKeys - Keys used to generate unique cache identifiers.
     * @param defaultParameters - Default parameters for computations, providing a baseline for all calculations.
     * @throws {Error} If cache keys are not provided.
     */
    constructor(cogni: CogniInterface<TParam, TResult>, cacheKeys?: (keyof TParam)[], defaultParameters?: Partial<TParam>);
    /**
     * Retrieves a computed value for a given key, prioritizing cached values.
     * If the value is not in cache, it computes and caches the result.
     * This method optimizes data retrieval by reducing computational overhead.
     *
     * @param value - Key of the value to retrieve.
     * @param params - Parameters for computing the value, if not cached.
     * @returns A promise resolving to the computed or cached value, or null if not found.
     */
    get<K extends keyof TResult>(value: K, params: Partial<TParam>): Promise<TResult[K] | null>;
    /**
     * Adds a new storage instance to the CogniStore, enhancing its caching capabilities.
     * This allows for flexibility in choosing and combining different caching strategies.
     *
     * @param storage - The storage instance to integrate into the CogniStore.
     */
    addStorage(storage: CogniStoreInteraface<TParam, TResult>): void;
    /**
     * Removes a specified storage instance from the CogniStore's caching system.
     * This is useful for dynamically adjusting caching strategies at runtime.
     *
     * @param storage - The storage instance to be removed from the CogniStore.
     */
    removeStorage(storage: CogniStoreInteraface<TParam, TResult>): void;
    /**
     * Generates a unique cache key based on selected parameters.
     * This method is crucial for ensuring that each cache entry is accurately and uniquely identified.
     *
     * @param params - Parameters used to construct the cache key.
     * @returns The constructed cache key.
     */
    generateCacheKey(params: TParam): string;
}
export default CogniStore;