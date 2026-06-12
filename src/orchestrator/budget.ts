import type { BudgetSnapshot } from "../types";

/**
 * Pessimistic reservation budget.
 *
 * A naive `remaining > 0` check has a race: N concurrent agents pass the
 * check in the same tick, then all N issue calls that each consume up to
 * `input + max_tokens` — worst-case overshoot is concurrency × per-call-max.
 *
 * Instead every call must reserve a (generous) estimate BEFORE it is issued
 * and commits the actual usage afterwards. `reserve()` runs synchronously
 * between awaits, so in Node's single-threaded event loop the invariant
 *
 *     used + reserved <= limit
 *
 * holds at every instant: no call is ever started that could take the run
 * over budget. `peak` records the highest observed used+reserved — the eval
 * asserts peak <= limit.
 */
export class TokenBudget {
  private used: number;
  private reserved = 0;
  private peakVal: number;

  constructor(
    readonly limit: number,
    initialUsed = 0,
  ) {
    this.used = initialUsed;
    this.peakVal = initialUsed;
  }

  reserve(estimate: number): boolean {
    if (this.used + this.reserved + estimate > this.limit) return false;
    this.reserved += estimate;
    this.peakVal = Math.max(this.peakVal, this.used + this.reserved);
    return true;
  }

  /** undo a reservation without consuming (e.g. the call never happened) */
  release(estimate: number): void {
    this.reserved -= estimate;
  }

  /** swap the reservation for what the call actually consumed */
  commit(estimate: number, actual: number): void {
    this.reserved -= estimate;
    this.used += actual;
    this.peakVal = Math.max(this.peakVal, this.used + this.reserved);
  }

  get snapshot(): BudgetSnapshot {
    return { limit: this.limit, used: this.used, reserved: this.reserved, peak: this.peakVal };
  }
}
