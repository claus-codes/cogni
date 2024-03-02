import cogniAsync from './async';

jest.useFakeTimers();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('cogniAsync', () => {
  it('should compute basic operation with a synchronous ComputeFunction', async () => {
    const { define, get } = cogniAsync<{}, { result: number }>();

    define('result', () => 42);

    await expect(get('result', {})).resolves.toBe(42);
  });

  it('should handle dependency computation', async () => {
    const { define, get } = cogniAsync<
      { base: number },
      { double: number; triple: number }
    >();

    define('double', async ({ base }) => base * 2);
    define('triple', async ({ base }) => base * 3);

    await expect(get('double', { base: 2 })).resolves.toBe(4);
    await expect(get('triple', { base: 3 })).resolves.toBe(9);
  });

  it('should manage complex dependency tree computations', async () => {
    const { define, get } = cogniAsync<
      { a: number; b: number },
      { sum: number; product: number; combined: number }
    >();

    define('sum', async ({ a, b }) => a + b);
    define('product', async ({ a, b }) => a * b);
    define('combined', async (params, { sum, product }) => sum + product, [
      'sum',
      'product',
    ]);

    await expect(get('combined', { a: 2, b: 3 })).resolves.toBe(11); // (2 + 3) + (2 * 3)
  });

  it('should return multiple values with getMany', async () => {
    const { define, getMany } = cogniAsync<
      { value: number },
      { double: number; square: number }
    >();

    define('double', async ({ value }) => value * 2);
    define('square', async ({ value }) => value * value);

    const result = await getMany(['double', 'square'], { value: 3 });

    expect(result.double).toBe(6);
    expect(result.square).toBe(9);
  });

  it('should execute parent compute function only once when multiple children depend on it', async () => {
    const { define, getMany } = cogniAsync<
      {},
      { parent: number; child1: number; child2: number }
    >();

    // Creating a mock function for the parent compute function
    const mockParentFunction = jest.fn().mockResolvedValue(10);

    // Defining the parent node
    define('parent', mockParentFunction);

    // Defining child nodes that depend on the parent node
    define('child1', async (params, { parent }) => parent + 1, ['parent']);
    define('child2', async (params, { parent }) => parent + 2, ['parent']);

    // Retrieving both child nodes in a single call
    await getMany(['child1', 'child2'], {});

    // Expect the parent mock function to have been called only once
    expect(mockParentFunction).toHaveBeenCalledTimes(1);
  });

  it('should handle delayed computation with mocked timer', async () => {
    const { define, get } = cogniAsync<{}, { delayedResult: number }>();

    // Define a function that resolves after a delay
    define('delayedResult', async () => {
      await delay(1000);
      return 100;
    });

    const promise = get('delayedResult', {});

    // Fast-forward time by 1 second
    await jest.advanceTimersByTimeAsync(1000);

    // Await the result after advancing the timers
    const result = await promise;

    expect(result).toBe(100);
  });

  it('should handle concurrent computations correctly', async () => {
    const { define, getMany } = cogniAsync<
      {},
      { first: number; second: number }
    >();

    define('first', async () => 1);
    define('second', async () => 2);

    const results = await getMany(['first', 'second'], {});
    expect(results).toEqual({ first: 1, second: 2 });
  });

  it('should resolve dependencies in the correct sequential order', async () => {
    const { define, get } = cogniAsync<
      {},
      { first: string; second: string; combined: string }
    >();

    const order: string[] = [];

    define('first', async () => {
      order.push('first');
      return 'First';
    });

    define('second', async () => {
      order.push('second');
      return 'Second';
    });

    define(
      'combined',
      async (params, { first, second }) => `${first} and ${second}`,
      ['first', 'second'],
    );

    await get('combined', {});

    // Check if the dependencies are resolved in the correct order
    expect(order).toEqual(['first', 'second']);
  });

  it('should throw error for undefined key', async () => {
    type Params = { [key: string]: any };
    type Results = { [key: string]: any };

    const { get } = cogniAsync<Params, Results>();

    await expect(get('undefinedKey', {})).rejects.toThrow();
  });

  test('should throw error when defining a value with undefined parent value', () => {
    type Params = { base: number };
    type Results = { double: number; triple: number };

    const { define } = cogniAsync<Params, Results>();

    // Attempt to define a node with a non-existent parent node
    expect(() => {
      define('triple', async ({ base }, { double }) => base * 3, ['double']);
    }).toThrow();
  });

  it('should correctly handle a failing promise', async () => {
    const { define, get } = cogniAsync<{}, { errorResult: number }>();

    define('errorResult', () => {
      return new Promise((_, reject) => {
        reject(new Error('Intentional failure'));
      });
    });

    // Expect the promise to reject and check if the error message is correct
    await expect(get('errorResult', {})).rejects.toThrow('Intentional failure');
  });

  it('should compute parallelizable operations in parallel', async () => {
    const { define, get } = cogniAsync<
      {},
      { a: string; b: string; c: string }
    >();

    define('a', async () => {
      await delay(1000);
      return 'A';
    });

    define('b', async () => {
      await delay(1000);
      return 'B';
    });

    define(
      'c',
      (_, { a, b }) => {
        return `${a} ${b}`;
      },
      ['a', 'b'],
    );

    const result = get('c', {});

    await jest.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toBe('A B');
  });
});
