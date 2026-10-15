import { createRequire } from "node:module";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { countPrimesJS } from "./jsMath.js";

const require = createRequire(import.meta.url);

interface MathAddon {
  countPrimes(limit: number): number;
  maxLimit: number;
}

const nativeMath = require("./build/Release/math_addon.node") as MathAddon;

/**
 * Parses and validates the limit before either implementation sees it.
 *
 * `parseInt` is deliberately avoided: it silently truncates input like "1e6"
 * down to 1 and happily accepts "12abc".
 */
function parseLimit(
  answer: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = answer.trim();
  if (trimmed === "")
    return { ok: false, message: "Please enter a valid positive integer." };

  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return {
      ok: false,
      message: "Please enter a whole number (for example: 10000000).",
    };
  }
  if (value < 2) {
    return { ok: false, message: "Please enter an integer of at least 2." };
  }
  if (value > nativeMath.maxLimit) {
    return {
      ok: false,
      message: `Please enter a value no greater than ${nativeMath.maxLimit.toLocaleString()}.`,
    };
  }
  return { ok: true, value };
}

/** Guards the ratio so tiny inputs never render as NaN or Infinity. */
function formatSpeedup(timeJS: number, timeCPP: number): string {
  if (timeCPP <= 0) return "C++ finished too fast to measure a ratio.";
  const speedup = timeJS / timeCPP;
  if (!Number.isFinite(speedup))
    return "C++ finished too fast to measure a ratio.";
  return `C++ was approximately ${speedup.toFixed(1)}x faster than highly optimized JS.`;
}

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log("=== Performance Benchmark: JS vs Native C++ ===");
  console.log(
    "Suggestion: Try 10000000 (10 Million) to clearly perceive the difference.\n",
  );

  try {
    const answer = await rl.question("Enter a limit to count primes up to: ");
    const parsed = parseLimit(answer);

    if (!parsed.ok) {
      console.error(`❌ Error: ${parsed.message}`);
      return;
    }
    const limit = parsed.value;

    console.log(
      `\nProcessing... running algorithms up to ${limit.toLocaleString()}\n`,
    );

    // --- BENCHMARK JAVASCRIPT ---
    console.log("🐢 Running JavaScript computation...");
    const startJS = performance.now();
    const countJS = countPrimesJS(limit);
    const timeJS = performance.now() - startJS;
    console.log(
      `↳ JS Found ${countJS.toLocaleString()} primes in ${timeJS.toFixed(2)}ms\n`,
    );

    // --- BENCHMARK NATIVE C++ ---
    console.log("⚡ Running Native C++ computation...");
    const startCPP = performance.now();
    const countCPP = nativeMath.countPrimes(limit);
    const timeCPP = performance.now() - startCPP;
    console.log(
      `↳ C++ Found ${countCPP.toLocaleString()} primes in ${timeCPP.toFixed(2)}ms\n`,
    );

    // --- BREAKDOWN ---
    console.log("============ RESULTS ============");
    if (countJS !== countCPP) {
      console.error(
        `⚠️  MISMATCH: JS counted ${countJS.toLocaleString()} but C++ counted ` +
          `${countCPP.toLocaleString()}. The comparison below is not trustworthy.`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `✅ Both implementations agree: ${countJS.toLocaleString()} primes.`,
      );
    }
    console.log(formatSpeedup(timeJS, timeCPP));
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
