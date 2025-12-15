import { parallelMap } from '../utils';

describe('parallelMap', () => {
  it('processes items in parallel with limited concurrency', async () => {
    const items = [1, 2, 3, 4, 5];
    const processingOrder: number[] = [];

    const results = await parallelMap(items, 2, async (item) => {
      processingOrder.push(item);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return item * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(results.length).toBe(items.length);
  });

  it('preserves order of results regardless of completion order', async () => {
    // Items that take different times to process
    const items = [100, 10, 50, 20, 80];

    const results = await parallelMap(items, 3, async (item) => {
      // Simulate varying processing times based on item value
      await new Promise((resolve) => setTimeout(resolve, item / 10));
      return `result-${item}`;
    });

    // Results should be in original order, not completion order
    expect(results).toEqual(['result-100', 'result-10', 'result-50', 'result-20', 'result-80']);
  });

  it('handles empty array', async () => {
    const results = await parallelMap([], 4, async () => 'never called');
    expect(results).toEqual([]);
  });

  it('handles single item', async () => {
    const results = await parallelMap([42], 4, async (item) => item * 2);
    expect(results).toEqual([84]);
  });

  it('respects concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const items = [1, 2, 3, 4, 5, 6];

    await parallelMap(items, 2, async (item) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 20));
      concurrent--;
      return item;
    });

    expect(maxConcurrent).toBe(2);
  });

  it('handles concurrency greater than item count', async () => {
    const items = [1, 2];
    const results = await parallelMap(items, 10, async (item) => item * 3);
    expect(results).toEqual([3, 6]);
  });

  it('propagates errors correctly', async () => {
    const items = [1, 2, 3];

    await expect(
      parallelMap(items, 2, async (item) => {
        if (item === 2) throw new Error('Test error');
        return item;
      })
    ).rejects.toThrow('Test error');
  });
});
