/**
 * Prime counting in JavaScript.
 *
 * This deliberately mirrors the C++ addon's algorithm (segmented sieve of
 * Eratosthenes over the odd numbers) so the benchmark compares *runtime and
 * concurrency*, not two different algorithms.
 */

/** Odd numbers represented per segment; matches the native implementation. */
const SEGMENT_ODDS = 1 << 17;

/**
 * Reference trial-division primality test.
 *
 * Kept exported because it is the textbook form of the check, but it is
 * O(sqrt(n)) per call and is NOT used by countPrimesJS.
 */
export function isPrimeJS(number: number): boolean {
  if (number <= 1) return false;
  if (number === 2) return true;
  if (number % 2 === 0) return false;

  const boundary = Math.sqrt(number);
  for (let i = 3; i <= boundary; i += 2) {
    if (number % i === 0) return false;
  }
  return true;
}

/** Base primes up to sqrt(limit), odd only. */
function buildBasePrimes(root: number): number[] {
  const composite = new Uint8Array(root + 1);
  const primes: number[] = [];
  for (let i = 3; i <= root; i += 2) {
    if (composite[i]) continue;
    primes.push(i);
    for (let j = i * i; j <= root; j += 2 * i) {
      composite[j] = 1;
    }
  }
  return primes;
}

/**
 * Counts primes <= limit using a segmented sieve of Eratosthenes.
 *
 * O(n log log n) time and O(1) memory in `limit` - segments are 128 KiB and
 * stay resident in cache regardless of how large the input gets.
 */
export function countPrimesJS(limit: number): number {
  if (!Number.isFinite(limit) || limit < 2) return 0;
  const n = Math.floor(limit);

  // Only odd numbers are represented, so the upper bound must be odd.
  // Rounding up here would count a prime past the requested limit.
  const lastOdd = n % 2 === 1 ? n : n - 1;
  if (lastOdd < 3) return 1; // only the prime 2

  const base = buildBasePrimes(Math.floor(Math.sqrt(n)));
  const segmentCount = Math.floor((lastOdd - 3) / (2 * SEGMENT_ODDS)) + 1;

  const composite = new Uint8Array(SEGMENT_ODDS);
  let total = 1; // the prime 2

  for (let s = 0; s < segmentCount; s++) {
    composite.fill(0);
    const lo = 3 + 2 * s * SEGMENT_ODDS;
    let hi = lo + 2 * (SEGMENT_ODDS - 1);
    if (hi > lastOdd) hi = lastOdd;

    for (let i = 0; i < base.length; i++) {
      const p = base[i];
      if (p * p > hi) break;
      let first = Math.max(p * p, Math.ceil(lo / p) * p);
      if (first % 2 === 0) first += p; // only odd multiples are represented
      for (let j = first; j <= hi; j += 2 * p) {
        composite[(j - lo) >> 1] = 1;
      }
    }

    const valid = Math.min(SEGMENT_ODDS, ((hi - lo) >> 1) + 1);
    for (let i = 0; i < valid; i++) {
      if (!composite[i]) total++;
    }
  }

  return total;
}
