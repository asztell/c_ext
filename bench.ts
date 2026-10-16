/**
 * Reproducible benchmark sweep.
 *
 * Prints a markdown table matching the scaling table in README.md, so the
 * published numbers can be regenerated on any machine rather than copied
 * by hand. Speedup depends heavily on core count, which is printed
 * alongside the results for that reason.
 *
 *   npx tsx bench.ts                  # default limits
 *   npx tsx bench.ts 1e6 1e8          # explicit limits
 */
import { createRequire } from "node:module";
import { cpus } from "node:os";
import { countPrimesJS } from "./jsMath.js"; // .js extension for TS NodeNext resolution

const require = createRequire(import.meta.url);

interface MathAddon {
  countPrimes(limit: number): number;
  maxLimit: number;
}

const nativeMath = require("./build/Release/math_addon.node") as MathAddon;

const DEFAULT_LIMITS = [10_000_000, 200_000_000, 1_000_000_000];

/**
 * Authoritative values for the prime-counting function. Limits not listed
 * here are still checked against each other, just not against a reference.
 */
const KNOWN: ReadonlyMap<number, number> = new Map([
  [10_000_000, 664_579],
  [200_000_000, 11_078_937],
  [1_000_000_000, 50_847_534],
]);

const WARMUP_LIMIT = 1_000_000;

interface Row {
  limit: number;
  countJS: number;
  countCPP: number;
  msJS: number;
  msCPP: number;
  speedup: number | null;
  status: "ok" | "mismatch" | "unverified";
}

function parseLimits(argv: string[]): number[] {
  if (argv.length === 0) return DEFAULT_LIMITS;

  const limits: number[] = [];
  for (const arg of argv) {
    const value = Number(arg);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      console.error(`❌ "${arg}" is not a whole number.`);
      process.exit(1);
    }
    if (value < 2 || value > nativeMath.maxLimit) {
      console.error(
        `❌ ${value.toLocaleString()} is outside the supported range 2..${nativeMath.maxLimit.toLocaleString()}.`,
      );
      process.exit(1);
    }
    limits.push(value);
  }
  return [...new Set(limits)].sort((a, b) => a - b);
}

function time<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

function runLimit(limit: number): Row {
  const js = time(() => countPrimesJS(limit));
  const cpp = time(() => nativeMath.countPrimes(limit));

  if (js.value !== cpp.value) {
    return {
      limit,
      countJS: js.value,
      countCPP: cpp.value,
      msJS: js.ms,
      msCPP: cpp.ms,
      speedup: null,
      status: "mismatch",
    };
  }

  const expected = KNOWN.get(limit);
  return {
    limit,
    countJS: js.value,
    countCPP: cpp.value,
    msJS: js.ms,
    msCPP: cpp.ms,
    // Guard against a sub-millisecond C++ run producing an Infinity ratio.
    speedup: cpp.ms > 0 && Number.isFinite(js.ms / cpp.ms) ? js.ms / cpp.ms : null,
    status: expected === undefined ? "unverified" : expected === js.value ? "ok" : "mismatch",
  };
}

function main(): void {
  const limits = parseLimits(process.argv.slice(2));
  const cores = cpus().length;

  console.log(`Warming up JIT at ${WARMUP_LIMIT.toLocaleString()}...`);
  countPrimesJS(WARMUP_LIMIT);
  nativeMath.countPrimes(WARMUP_LIMIT);

  console.log(`Benchmarking on ${cores} cores (node ${process.version})\n`);

  const rows = limits.map(runLimit);
  for (const row of rows) {
    const note = row.status === "ok" ? "verified" : row.status === "unverified" ? "unverified" : "MISMATCH";
    console.error(
      `  ${row.limit.toLocaleString().padStart(15)}  ` +
        `js=${row.msJS.toFixed(2)}ms  cpp=${row.msCPP.toFixed(2)}ms  ` +
        `primes=${row.countJS.toLocaleString()}  ${note}`,
    );
  }

  // Markdown table, directly pasteable into README.md.
  console.log(`\n| Limit | JS (1 thread) | C++ (${cores} threads) | Speedup |`);
  console.log(`|------:|--------------:|-------------------:|--------:|`);
  for (const row of rows) {
    const speedup = row.speedup === null ? "n/a" : `${row.speedup.toFixed(1)}x`;
    const msJS = row.msJS >= 100 ? `${(row.msJS / 1000).toFixed(2)}s` : `${row.msJS.toFixed(1)}ms`;
    const msCPP = row.msCPP >= 100 ? `${(row.msCPP / 1000).toFixed(2)}s` : `${row.msCPP.toFixed(2)}ms`;
    console.log(`| ${row.limit.toLocaleString()} | ${msJS} | ${msCPP} | ${speedup} |`);
  }

  const bad = rows.filter((r) => r.status === "mismatch");
  if (bad.length > 0) {
    console.error(`\n❌ ${bad.length} limit(s) disagreed between JS and C++.`);
    for (const row of bad) {
      console.error(`   ${row.limit.toLocaleString()}: js=${row.countJS} cpp=${row.countCPP}`);
    }
    process.exitCode = 1;
  }
}

main();