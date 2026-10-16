# Node.js Performance Benchmark: JS vs. Multithreaded Native C++ Addon

This project demonstrates how to bypass the single-threaded performance limits of Node.js by writing a high-performance **C++ Native Addon** using **Node-API (`node-addon-api`)**. 

The benchmark compares a highly optimized JavaScript loop running on Node's main execution thread against a native C++ implementation that leverages **true hardware concurrency (multithreading)** across all available CPU cores.

Both implementations use the same **segmented sieve of Eratosthenes over the odd numbers** (O(n log log n) time, O(1) memory), so the comparison measures the runtime rather than the algorithm. See [Benchmark Honesty](#%EF%B8%8F-a-note-on-benchmark-honesty) for why that distinction matters.

---

## 📊 Benchmark Results

Running on an **Apple Silicon MacBook Pro (M-Series, 14 cores)** to count total prime numbers up to **200,000,000**:

```text
=== Performance Benchmark: JS vs Native C++ ===
Processing... running algorithms up to 200,000,000

🐢 Running JavaScript computation...
↳ JS Found 11,078,937 primes in 179.08ms

⚡ Running Native C++ computation...
↳ C++ Found 11,078,937 primes in 10.50ms

✅ Both implementations agree: 11,078,937 primes.
C++ was approximately 17.1x faster than highly optimized JS.
```

### ⚖️ A Note on Benchmark Honesty

Both sides use the **same algorithm** — a segmented sieve of Eratosthenes over the odd numbers.

This matters. An earlier version of this project compared C++ trial division against JavaScript trial division and reported an 11.7x win. That number was misleading: nearly all of the gap came from the *algorithm*, not from being native. Simply switching both sides to the sieve collapsed the same 200M workload from **47 seconds (JS)** and **4.1 seconds (C++)** down to **179ms** and **10.5ms**.

The ~17x figure above is the number that actually means something, because it now isolates what the project is really about — native code plus hardware concurrency versus a single-threaded JIT.

### 🧠 Why the Gap Exists

1. **True Multithreading:** JavaScript is bound to a single execution thread inside V8. The addon detects hardware capabilities (`std::thread::hardware_concurrency()`), then clamps the thread count to the available work so small inputs never pay a pointless spawn cost.
2. **Native Code Quality:** V8's JIT is excellent, but machine code generated through the JS type system still carries overhead that `-O3` native compilation does not.
3. **Deliberate Algorithmic Parity:** Because both sides run the same sieve, the remaining gap is attributable to runtime and parallelism rather than to one side having a better algorithm.

### 📈 How the Numbers Scale

| Limit | JS (1 thread) | C++ (14 threads) | Speedup |
|------:|--------------:|-----------------:|--------:|
| 10,000,000 | 10.9ms | 2.12ms | 5.2x |
| 200,000,000 | 173.1ms | 10.20ms | 17.0x |
| 1,000,000,000 | 888.2ms | 49.87ms | 17.8x |

The ratio improves with input size because the native side's core count is only fully exploited once there is enough work to distribute.

> **These figures are hardware-specific.** Reproduce them on your own machine with `npm run bench`, which prints the same table in pasteable markdown and verifies each count against known values.

---

## 🧪 Testing

Correctness is covered by an assertion suite:

```bash
npm test
```

It verifies both implementations against authoritative prime-counting values, cross-checks them against an independently written reference sieve over odd/even and off-by-one limits, confirms JS and native agree across a 2..5,000 sweep, and asserts that out-of-range or malformed input is **rejected rather than silently truncated**.

> **Why this matters:** the original addon read its argument with `Int32Value()`, which wraps modulo 2³² with no error. `countPrimes(3000000000)` returned `0`, and `countPrimes(9000000000)` happily computed the prime count for a completely different number. The input is now validated and out-of-range values throw a `RangeError`.

---

## 🛠️ Project Stack & Configuration

- **Runtime:** Node.js (v24+)
- **Language:** TypeScript (v5+) + C++17
- **Runner:** `tsx` (for native ESM/TS runtime execution)
- **Native Bridge:** Node-API (`node-addon-api`)

---

## 🚀 How to Run and Build

### 1. Installation
Install the project development dependencies and TypeScript definitions:
```bash
npm install
```

### 2. Configure and Compile the C++ Extension
Generate the build system configurations and compile the `addon.cpp` source code into a native `.node` binary bundle:
```bash
npm run config
npm run rebuild
```

### 3. Run the Benchmark
Launch the interactive terminal script to input your limits and see the live performance analysis:
```bash
npm start
```

### 4. Run the Test Suite
Verify correctness of both implementations, including boundary and out-of-range handling:
```bash
npm test
```

### 5. Reproduce the Benchmark Numbers
Run the scaling sweep that generates the table above:
```bash
npm run bench                 # default limits: 10M, 200M, 1B
npx tsx bench.ts 1e6 1e8      # or your own limits
```

It warms up the JIT first, checks every result against known prime counts, and prints a markdown table ready to paste into this README.

---

## ⚙️ Editor Diagnostics Setup (VS Code)
To resolve `#include <napi.h>` or missing `node_api.h` dependency tracking warnings inside VS Code, ensure your local workspace `.vscode/c_cpp_properties.json` includes the local Node cache pathing hook:

```json
{
  "configurations": [
    {
      "name": "Mac",
      "includePath": [
        "\${workspaceFolder}/**",
        "\${workspaceFolder}/node_modules/node-addon-api",
        "\${userHome}/Library/Caches/node-gyp/**"
      ],
      "compilerPath": "/usr/bin/clang++",
      "cStandard": "c17",
      "cppStandard": "c++17",
      "intelliSenseMode": "macos-clang-arm64"
    }
  ],
  "version": 4
}
```

## 🐳 Running Everywhere with Docker Compose

Because this application uses a compiled C++ binary, running it natively requires matching system architectures and host compiler configurations. To build and run this application safely on any machine (Windows, Intel Mac, Linux) without setting up local development headers, you can use the modern **Docker Compose V2** profile configuration.

### 1. Build and Run Container Space Interactively
To compile the environment directly inside a standard Linux layer and attach your host keyboard to the container input prompt:

```bash
docker compose run --rm benchmark
```

*(Note: The `--rm` flag automatically destroys the container instance when you finish running your benchmarks to keep your Docker system clean).*

### 2. Manual Rebuilds
If you modify your C++ (`addon.cpp`) or TypeScript (`index.ts`) files, force the Docker system to clean rebuild the image layout structures before launching:

```bash
docker compose build --no-cache
docker compose run --rm benchmark
```
