import Arvo from './arvo';

describe('Arvo', () => {
  describe('Inheritance of computed values', () => {
    it('should compute values based on dependent values', () => {
      const gen = new Arvo<{ x: number }, { parent: number, child: number }>();

      gen.define('parent', ({ x }) => x);
      gen.define('child', ({ parent: { parent } }) => parent * 2, ['parent']);

      const childValue = gen.get('child', { x: 5 });
      expect(childValue).toBe(10);
    });
  });

  describe('ComputeFunction invocation', () => {
    it('should invoke each dependent ComputeFunction only once per get invocation', () => {
        const gen = new Arvo<{ value: number }, { parent: number, child1: number, child2: number, finalChild: number }>();

        const parentMock = jest.fn().mockReturnValue(5);
        const child1Mock = jest.fn().mockImplementation(({ parent: { parent } }) => parent + 10);
        const child2Mock = jest.fn().mockImplementation(({ parent: { parent } }) => parent * 2);
        const finalChildMock = jest.fn().mockImplementation(({ parent: { child1, child2 } }) => child1 + child2);

        gen.define('parent', parentMock);
        gen.define('child1', child1Mock, ['parent']);
        gen.define('child2', child2Mock, ['parent']);
        gen.define('finalChild', finalChildMock, ['child1', 'child2']);

        gen.get('finalChild', { value: 5 });

        expect(parentMock).toHaveBeenCalledTimes(1);
        expect(child1Mock).toHaveBeenCalledTimes(1);
        expect(child2Mock).toHaveBeenCalledTimes(1);
        expect(finalChildMock).toHaveBeenCalledTimes(1);
        expect(finalChildMock).toHaveBeenCalledWith({ value: 5, parent: { child1: 15, child2: 10 } });
    });
  });

  describe('Deeply Nested Dependencies', () => {
    it('should correctly compute values with multiple layers of dependencies', () => {
      const gen = new Arvo<{ base: number }, { a: number, b: number, c: number, d: number, e: number }>();

      gen.define('a', ({ base }) => base * 2);
      gen.define('b', ({ parent: { a } }) => a + 3, ['a']);
      gen.define('c', ({ parent: { b } }) => b * 2, ['b']);
      gen.define('d', ({ parent: { c } }) => c - 5, ['c']);
      gen.define('e', ({ parent: { d } }) => d * d, ['d']);

      const result = gen.get('e', { base: 3 });
      expect(result).toBe(169); // Calculation: 3*2 = 6, 6+3 = 9, 9*2 = 18, 18-5 = 13, 13*13 = 169
    });
  });

  describe('Error handling', () => {
    it('should throw an error when attempting to redefine a ComputeFunction for an existing key', () => {
      const gen = new Arvo<{ value: number }, { parent: number }>();

      const parentMock1 = jest.fn();
      const parentMock2 = jest.fn();

      gen.define('parent', parentMock1);

      expect(() => {
        gen.define('parent', parentMock2);
      }).toThrowError(/"parent" is already defined!/);
    });

    it('should throw an error when a ComputeFunction is defined with undefined dependencies', () => {
      const gen = new Arvo<{ value: number }, { parent: number, child: number }>();

      const childMock = jest.fn();

      expect(() => {
        gen.define('child', childMock, ['parent']);
      }).toThrowError(/Dependency "parent" has not been defined yet!/);
    });
  });
});