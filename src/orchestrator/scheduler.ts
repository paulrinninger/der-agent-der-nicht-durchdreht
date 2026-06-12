/**
 * Hand-rolled worker pool — deliberately no `Promise.all` over the whole
 * item list and no p-limit dependency. `concurrency` workers pull items off
 * a shared cursor until the queue is empty or the run is stopped; memory and
 * concurrency stay flat whether there are 15 items or 200.
 *
 * The pool itself never rejects: worker errors are routed to `onWorkerError`
 * so one bad item can never tear down its siblings (isolation).
 */

export interface PoolOptions<T> {
  items: T[];
  concurrency: number;
  worker: (item: T, index: number) => Promise<void>;
  /** checked before claiming the next item — the kill switch's entry point */
  shouldStop?: () => boolean;
  onWorkerError?: (item: T, err: unknown) => void;
  /** called whenever the number of simultaneously active workers changes */
  onActiveChange?: (active: number, highWaterMark: number) => void;
}

export interface PoolResult {
  highWaterMark: number;
  processed: number;
}

export async function runPool<T>(opts: PoolOptions<T>): Promise<PoolResult> {
  const limit = Math.max(1, Math.floor(opts.concurrency));
  let cursor = 0;
  let active = 0;
  let hwm = 0;
  let processed = 0;

  const runner = async (): Promise<void> => {
    while (true) {
      if (opts.shouldStop?.()) return;
      const index = cursor++;
      if (index >= opts.items.length) return;

      active++;
      hwm = Math.max(hwm, active);
      opts.onActiveChange?.(active, hwm);
      try {
        await opts.worker(opts.items[index], index);
        processed++;
      } catch (err) {
        opts.onWorkerError?.(opts.items[index], err);
      } finally {
        active--;
        opts.onActiveChange?.(active, hwm);
      }
    }
  };

  // bounded by `limit` runners — never by the length of the item list
  await Promise.all(Array.from({ length: Math.min(limit, opts.items.length) }, runner));
  return { highWaterMark: hwm, processed };
}
