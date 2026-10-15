import { createRequire } from "node:module";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { countPrimesJS } from "./jsMath.js"; // Notice the .js extension for TS NodeNext resolution

const require = createRequire(import.meta.url);

interface MathAddon {
  countPrimes(limit: number): number;
}

const nativeMath = require("./build/Release/math_addon.node") as MathAddon;

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log("=== Performance Benchmark: JS vs Native C++ ===");
  console.log(
    "Suggestion: Try 10000000 (10 Million) to clearly perceive the difference.\n",
  );

  try {
    const answer = await rl.question("Enter a limit to count primes up to: ");
    const limit = parseInt(answer.trim(), 10);

    if (isNaN(limit) || limit <= 0) {
      console.error("❌ Error: Please enter a valid positive integer.");
      rl.close();
      return;
    }

    console.log(
      `\nProcessing... running algorithms up to ${limit.toLocaleString()}\n`,
    );

    // --- BENCHMARK JAVASCRIPT ---
    console.log("🐢 Running JavaScript computation...");
    const startJS = performance.now();
    const countJS = countPrimesJS(limit);
    const endJS = performance.now();
    const timeJS = endJS - startJS;
    console.log(
      `↳ JS Found ${countJS.toLocaleString()} primes in ${timeJS.toFixed(2)}ms\n`,
    );

    // --- BENCHMARK NATIVE C++ ---
    console.log("⚡ Running Native C++ computation...");
    const startCPP = performance.now();
    const countCPP = nativeMath.countPrimes(limit);
    const endCPP = performance.now();
    const timeCPP = endCPP - startCPP;
    console.log(
      `↳ C++ Found ${countCPP.toLocaleString()} primes in ${timeCPP.toFixed(2)}ms\n`,
    );

    // --- BREAKDOWN ---
    const speedup = timeJS / timeCPP;
    console.log("============ RESULTS ============");
    console.log(
      `C++ was approximately ${speedup.toFixed(1)}x faster than highly optimized JS.`,
    );
  } catch (error) {
    console.error("An unexpected error occurred:", error);
  } finally {
    rl.close();
  }
}

main();
