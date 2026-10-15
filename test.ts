import { createRequire } from "node:module";
import { countPrimesJS } from "./jsMath.js"; // .js extension for TS NodeNext resolution

const require = createRequire(import.meta.url);

interface MathAddon {
  countPrimes(limit: number): number;
  maxLimit: number;
}

const nativeMath = require("./build/Release/math_addon.node") as MathAddon;

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed++;
  } else {
    failures.push(`${label}${detail ? ` -- ${detail}` : ""}`);
  }
}

/**
 * Straightforward full-array sieve, written differently from both
 * implementations on purpose so it is an independent reference.
 */
function referenceCountPrimes(limit: number): number {
  if (limit < 2) return 0;
  const composite = new Uint8Array(limit + 1);
  let count = 0;
  for (let i = 2; i <= limit; i++) {
    if (composite[i]) continue;
    count++;
    for (let j = i * i; j <= limit; j += i) composite[j] = 1;
  }
  return count;
}

/** Authoritative values for the prime-counting function. */
const KNOWN: Array<[number, number]> = [
  [2, 1],
  [3, 2],
  [4, 2],
  [5, 3],
  [6, 3],
  [10, 4],
  [16, 6],
  [18, 7],
  [22, 8],
  [28, 9],
  [40, 12],
  [58, 16],
  [60, 17],
  [100, 25],
  [122, 30],
  [1000, 168],
  [10_000, 1229],
  [100_000, 9592],
  [1_000_000, 78_498],
  [10_000_000, 664_579],
  [100_000_000, 5_761_455],
];

function expectThrows(label: string, fn: () => unknown, name: string): void {
  try {
    fn();
    check(label, false, "expected a throw, but none was raised");
  } catch (error) {
    check(label, error instanceof Error && error.name === name,
      `expected ${name}, got ${(error as Error)?.name}: ${(error as Error)?.message}`);
  }
}

console.log("=== 1. Known prime-counting values ===");
for (const [limit, expected] of KNOWN) {
  const js = countPrimesJS(limit);
  const cpp = nativeMath.countPrimes(limit);
  check(`pi(${limit}) js`, js === expected, `expected ${expected}, got ${js}`);
  check(`pi(${limit}) cpp`, cpp === expected, `expected ${expected}, got ${cpp}`);
}

console.log("=== 2. Odd/even and off-by-one limits vs independent reference ===");
// Every even limit here has a prime successor (limit+1), which is exactly the
// case that a `(limit | 1)` clamp gets wrong.
const EDGE_LIMITS = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18, 22, 28, 29, 30, 40, 41,
  58, 60, 61, 100, 122, 999, 1000, 1001, 65_535, 65_536, 65_537,
];
for (const limit of EDGE_LIMITS) {
  const expected = referenceCountPrimes(limit);
  const js = countPrimesJS(limit);
  const cpp = nativeMath.countPrimes(limit);
  check(`edge pi(${limit}) js`, js === expected, `expected ${expected}, got ${js}`);
  check(`edge pi(${limit}) cpp`, cpp === expected, `expected ${expected}, got ${cpp}`);
}

console.log("=== 3. JS and native agree across a sweep ===");
let sweepMismatch = false;
for (let limit = 2; limit <= 5_000; limit++) {
  if (countPrimesJS(limit) !== nativeMath.countPrimes(limit)) {
    failures.push(`sweep @${limit}: js and native disagree`);
    sweepMismatch = true;
    break;
  }
}
check("sweep 2..5000 js==cpp", !sweepMismatch);

console.log("=== 4. Out-of-range and malformed input is rejected, not truncated ===");
// These used to silently return 0 or a count for a completely different limit.
expectThrows("cpp rejects 2147483648", () => nativeMath.countPrimes(2_147_483_648), "RangeError");
expectThrows("cpp rejects 3000000000", () => nativeMath.countPrimes(3_000_000_000), "RangeError");
expectThrows("cpp rejects 9000000000", () => nativeMath.countPrimes(9_000_000_000), "RangeError");
expectThrows("cpp rejects NaN", () => nativeMath.countPrimes(NaN), "TypeError");
expectThrows("cpp rejects Infinity", () => nativeMath.countPrimes(Infinity), "TypeError");
expectThrows("cpp rejects 2.7", () => nativeMath.countPrimes(2.7), "TypeError");
expectThrows("cpp rejects 1", () => nativeMath.countPrimes(1), "RangeError");
expectThrows("cpp rejects -5", () => nativeMath.countPrimes(-5), "RangeError");
expectThrows("cpp rejects '100'", () => nativeMath.countPrimes("100" as never), "TypeError");
expectThrows("cpp rejects missing arg", () => (nativeMath.countPrimes as () => number)(), "TypeError");

// JS is defensive rather than throwing: it returns 0 for non-finite input.
// index.ts rejects these before they ever reach the addon.
check("js NaN -> 0", countPrimesJS(NaN) === 0);
check("js Infinity -> 0", countPrimesJS(Infinity) === 0);
check("js negative -> 0", countPrimesJS(-5) === 0);

console.log("=== 5. maxLimit is exported and enforced ===");
check("maxLimit is a positive integer", Number.isInteger(nativeMath.maxLimit) && nativeMath.maxLimit > 0,
  `got ${nativeMath.maxLimit}`);
expectThrows("cpp rejects maxLimit+1", () => nativeMath.countPrimes(nativeMath.maxLimit + 1), "RangeError");
check("cpp accepts maxLimit boundary", nativeMath.countPrimes(2_147_483_647) > 0);

console.log("\n" + "=".repeat(52));
if (failures.length === 0) {
  console.log(`ALL PASS  (${passed} assertions)`);
} else {
  console.log(`FAILED  (${passed} passed, ${failures.length} failed)`);
  for (const f of failures) console.log(`  x ${f}`);
  process.exitCode = 1;
}