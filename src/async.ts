/**
 * cogniAsync: A TypeScript library for efficient management of computed values in dependency graphs, with support for asynchronous computation functions.
 * Ideal for data processing, reactive programming, and dynamic content generation.
 *
 * @module cogniAsync
 * @version 1.2.0
 * @author 2023 Claus Nuoskanen
 */

import { DefaultRecord, ResultObject } from './index';

export type AsyncResultObject<T> = { [K in keyof T]: Promise<T[K]> };

/**
 * Interface for computation functions within cogniAsync's dependency graph.
 * Computes values based on input parameters and optional parent node values.
 *
 * @template TParam - The type of input parameters, typically an object with key-value pairs.
 * @template TResult - The type of the expected result object, defining the structure of computation outputs.
 * @template ReturnType - The specific return type of the compute function, often a single value or an element from TResult.
 *
 * @param param - The input parameters for the computation, structured as an object, defined by TParam.
 * @param parents - An object containing values from parent nodes, used as dependencies for the current computation, defined by TResult.
 * @returns The computed value, derived from the input parameters and parent node values.
 * @throws {Error} Thrown if required parameters are missing, or if parent node values are invalid or unavailable.
 */
export interface AsyncComputeFunction<
  TParam extends DefaultRecord = DefaultRecord,
  TResult extends DefaultRecord = DefaultRecord,
  ReturnType = TResult[keyof TResult],
> {
  /**
   * Performs a computation based on input parameters and parent values in the graph.
   *
   * @param param - Input parameters for the computation.
   * @param parents - Object containing previously computed values.
   * @returns The computed value.
   */
  (
    param: TParam,
    parents: ResultObject<TResult>,
  ): Promise<ReturnType> | ReturnType;
}

interface AsyncComputeFunctionInternal<
  TParam extends DefaultRecord = DefaultRecord,
  TResult extends DefaultRecord = DefaultRecord,
  ReturnType = TResult[keyof TResult],
> {
  (param: TParam, parents: AsyncResultObject<TResult>): Promise<ReturnType>;
}

/**
 * Initializes the cogniAsync computation manager for creating and managing computation nodes.
 *
 * @template TParam The type for input parameters of computation nodes, typically an object with key-value pairs.
 *                  This generic type allows for flexible and type-safe parameter definitions.
 * @template TResult The type for output results from computation nodes, structured as an object with key-value pairs.
 *                   This enables the library to manage and retrieve computation results in a structured and predictable manner.
 *
 * @returns An object representing the cogniAsync computation manager, containing methods `define`, `get`, and `getMany`.
 *          These methods are used for managing computation nodes, facilitating efficient and organized computation management.
 * @throws {Error} Throws an error if there are issues in defining or retrieving computed values, such as duplicate keys or undefined dependencies.
 */
export type cogniAsync<
  TParam extends DefaultRecord,
  TResult extends DefaultRecord,
> = {
  /**
   * Defines a compute function with a unique key and optional dependencies.
   *
   * @param key - Unique identifier for the compute function.
   * @param fn - Compute function for calculating values.
   * @param parentKeys - Keys of dependent computations.
   * @throws {Error} If the key is already defined or dependencies are undefined.
   */
  define: <K extends keyof TResult>(
    key: K,
    fn: AsyncComputeFunction<TParam, TResult, TResult[K]>,
    parentKeys?: Array<keyof TResult>,
  ) => void;

  /**
   * Retrieves a computed value for a given key.
   *
   * @param key - Identifier for the computed value.
   * @param param - Parameters for a `AsyncComputeFunction`.
   * @param results - Object containing previously computed values.
   * @returns The computed value.
   * @throws {Error} If the key is not defined.
   */
  get: <K extends keyof TResult>(
    key: K,
    param: TParam,
    results?: ResultObject<TResult>,
  ) => Promise<TResult[K]>;

  /**
   * Retrieves multiple computed values for specified keys.
   *
   * @param keys - Keys for required dependencies.
   * @param param - Parameters for a `AsyncComputeFunction`.
   * @param results - Object containing previously computed values.
   * @returns Object with dependency keys mapped to their computed values.
   * @throws {Error} If any key is not defined.
   */
  getMany: (
    keys: Array<keyof TResult>,
    param: TParam,
    results?: ResultObject<TResult>,
  ) => Promise<ResultObject<TResult>>;
};

function resultToAsyncResult<TResult>(
  result: ResultObject<TResult>,
): AsyncResultObject<TResult> {
  return Object.fromEntries(
    Object.entries(result).map(([key, value]) => [key, Promise.resolve(value)]),
  ) as AsyncResultObject<TResult>;
}

function cogniAsync<
  TParam extends Record<string, unknown> = DefaultRecord,
  TResult extends Record<string, unknown> = DefaultRecord,
>(): cogniAsync<TParam, TResult> {
  /**
   * Map of compute functions with their unique keys.
   * @private
   */
  const fnMap: Map<
    keyof TResult,
    AsyncComputeFunctionInternal<TParam, TResult, TResult[keyof TResult]>
  > = new Map();

  function define<K extends keyof TResult>(
    key: K,
    fn: AsyncComputeFunction<TParam, TResult, TResult[K]>,
    parentKeys?: Array<keyof TResult>,
  ) {
    // Ensure key is not already defined.
    if (fnMap.has(key)) {
      throw new Error(`Key "${key as string}" already exists!`);
    }

    // Ensure all required dependencies are defined.
    parentKeys?.forEach((parentKey) => {
      if (!fnMap.has(parentKey))
        throw new Error(`Key "${parentKey as string}" not found!`);
    });

    // Add the compute function to the map.
    fnMap.set(key, wrap(fn, parentKeys ?? []));
  }

  async function get<K extends keyof TResult>(
    key: K,
    param: TParam,
    results: ResultObject<TResult> = {} as ResultObject<TResult>,
  ): Promise<ResultObject<TResult>[K]> {
    // Return cached result if available.
    if (results[key]) {
      return results[key];
    }

    return getInternal(key, param, resultToAsyncResult(results));
  }

  async function getInternal<K extends keyof TResult>(
    key: K,
    param: TParam,
    results: AsyncResultObject<TResult> = {} as AsyncResultObject<TResult>,
  ): Promise<TResult[K]> {
    const result = results[key];
    if (result !== undefined) {
      return await result;
    }

    // Validate key existence and dependency resolution.
    const fn = fnMap.get(key);
    if (!fn) {
      throw new Error(`Key "${key as string}" not found!`);
    }

    // Compute and cache the result.
    results[key] = fn(param, results) as Promise<TResult[K]>;
    return await results[key];
  }

  async function getMany(
    keys: Array<keyof TResult>,
    param: TParam,
    results: ResultObject<TResult> = {} as ResultObject<TResult>,
  ): Promise<ResultObject<TResult>> {
    return getManyInternal(keys, param, resultToAsyncResult(results));
  }

  async function getManyInternal(
    keys: Array<keyof TResult>,
    param: TParam,
    results: AsyncResultObject<TResult> = {} as AsyncResultObject<TResult>,
  ): Promise<ResultObject<TResult>> {
    return await asyncDependencyResolver(keys, param, results);
  }

  /**
   * Resolves dependencies before executing the compute function.
   *
   * @param fn - Original compute function.
   * @param parentKeys - Keys of parent compute functions.
   * @returns Compute function with dependencies resolved first.
   * @private
   */
  function wrap<ReturnType>(
    fn: AsyncComputeFunction<TParam, TResult, ReturnType>,
    parentKeys: Array<keyof TResult>,
  ): AsyncComputeFunctionInternal<TParam, TResult, ReturnType> {
    return async (
      param: TParam,
      results: AsyncResultObject<TResult>,
    ): Promise<ReturnType> => {
      const parents = await getManyInternal(parentKeys, param, results);
      return await fn(param, parents);
    };
  }

  /**
   * Resolves dependencies and computes values asynchronously for specified keys using an instance of cogniAsync.
   * It executes the computations for the provided keys in parallel where possible, while ensuring dependent computations
   * are scheduled sequentially.
   *
   * @template TParam - The type for input parameters used in computation functions.
   * @template TResult - The type for the expected output results from computation functions.
   *
   * @param keys - The keys of the computations to be executed.
   * @param param - Parameters to be used for the computations in the cogni instance.
   * @param results - An object containing previously computed values.
   *
   * @returns A promise that resolves to an object containing the computed values for the specified keys.
   * @throws {Error} If any computation fails.
   */
  async function asyncDependencyResolver(
    keys: Array<keyof TResult>,
    param: TParam,
    results: AsyncResultObject<TResult> = {} as AsyncResultObject<TResult>,
  ): Promise<ResultObject<TResult>> {
    // Iterate over keys.
    const myResults = keys.map(async (key) => {
      if (!results[key]) {
        // Resolve the key and cache the result.
        results[key] = getInternal(key, param, results).catch((error) => {
          throw new Error(
            `Failed to resolve dependencies for key "${
              key as string
            }": ${error}`,
          );
        });
      }
      return [key, await results[key]] as const;
    });
    const resolvedResults = await Promise.all(myResults);
    return Object.fromEntries(resolvedResults) as ResultObject<TResult>;
  }

  return {
    define,
    get,
    getMany,
  };
}

export default cogniAsync;
