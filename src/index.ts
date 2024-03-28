/**
 * cogni: A TypeScript library for efficient management of computed values in dependency graphs.
 * Ideal for data processing, reactive programming, and dynamic content generation.
 *
 * @module cogni
 * @version 1.2.0
 * @author 2023 Claus Nuoskanen
 */

/**
 * A generic record object used as a flexible key-value pair structure.
 */
export type DefaultRecord = Record<string, unknown>;

/**
 * A generic object type with consistent key-value format for computation outputs.
 *
 * @template T - The base type from which the result object keys and values are derived.
 */
export type ResultObject<T> = { [K in keyof T]: T[K] };

/**
 * Interface for computation functions within cogni's dependency graph.
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
export interface ComputeFunction<
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
  (param: TParam, parents: ResultObject<TResult>): ReturnType;
}

/**
 * Initializes the cogni computation manager for creating and managing computation nodes.
 *
 * @template TParam The type for input parameters of computation nodes, typically an object with key-value pairs.
 *                  This generic type allows for flexible and type-safe parameter definitions.
 * @template TResult The type for output results from computation nodes, structured as an object with key-value pairs.
 *                   This enables the library to manage and retrieve computation results in a structured and predictable manner.
 *
 * @returns An object representing the Cogni computation manager, containing methods `define`, `get`, and `getMany`.
 *          These methods are used for managing computation nodes, facilitating efficient and organized computation management.
 * @throws {Error} Throws an error if there are issues in defining or retrieving computed values, such as duplicate keys or undefined dependencies.
 */
export type cogni<
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
    fn: ComputeFunction<TParam, TResult, TResult[K]>,
    parentKeys?: Array<keyof TResult>,
  ) => void;

  /**
   * Retrieves a computed value for a given key.
   *
   * @param key - Identifier for the computed value.
   * @param param - Parameters for a `ComputeFunction`.
   * @param results - Object containing previously computed values.
   * @returns The computed value.
   * @throws {Error} If the key is not defined.
   */
  get: <K extends keyof TResult>(
    key: K,
    param: TParam,
    results?: ResultObject<TResult>,
  ) => TResult[K];

  /**
   * Retrieves multiple computed values for specified keys.
   *
   * @param keys - Keys for required dependencies.
   * @param param - Parameters for a `ComputeFunction`.
   * @param results - Object containing previously computed values.
   * @returns Object with dependency keys mapped to their computed values.
   * @throws {Error} If any key is not defined.
   */
  getMany: (
    keys: Array<keyof TResult>,
    param: TParam,
    results?: ResultObject<TResult>,
  ) => ResultObject<TResult>;
};

function cogni<
  TParam extends Record<string, unknown> = DefaultRecord,
  TResult extends Record<string, unknown> = DefaultRecord,
>(): cogni<TParam, TResult> {
  /**
   * Map of compute functions with their unique keys.
   * @private
   */
  const fnMap: Map<
    keyof TResult,
    ComputeFunction<TParam, TResult, TResult[keyof TResult]>
  > = new Map();

  function define<K extends keyof TResult>(
    key: K,
    fn: ComputeFunction<TParam, TResult, TResult[K]>,
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
    fnMap.set(key, parentKeys ? wrap(fn, parentKeys) : fn);
  }

  function get<K extends keyof TResult>(
    key: K,
    param: TParam,
    results: ResultObject<TResult> = {} as ResultObject<TResult>,
  ): ResultObject<TResult>[K] {
    // Return cached result if available.
    if (results[key]) {
      return results[key];
    }

    // Validate key existence and dependency resolution.
    const fn = fnMap.get(key);
    if (!fn) {
      throw new Error(`Key "${key as string}" not found!`);
    }

    // Compute and cache the result.
    results[key] = fn(param, results) as TResult[K];
    return results[key];
  }

  function getMany(
    keys: Array<keyof TResult>,
    param: TParam,
    results: ResultObject<TResult> = {} as ResultObject<TResult>,
  ): ResultObject<TResult> {
    return keys.reduce(
       // I love this pattern of assign and evaluate, return <3
      (acc, key) => ((acc[key] = get(key, param, results)), acc),
      results,
    );
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
    fn: ComputeFunction<TParam, TResult, ReturnType>,
    parentKeys: Array<keyof TResult>,
  ): ComputeFunction<TParam, TResult, ReturnType> {
    return (param: TParam, results: ResultObject<TResult>): ReturnType =>
      fn(param, getMany(parentKeys, param, results ?? {}));
  }

  return {
    define,
    get,
    getMany,
  };
}

export default cogni;
