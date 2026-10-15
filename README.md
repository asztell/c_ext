# Node.js Performance Benchmark: JS vs. Multithreaded Native C++ Addon

This project demonstrates how to bypass the single-threaded performance limits of Node.js by writing a high-performance **C++ Native Addon** using **Node-API (`node-addon-api`)**. 

The benchmark compares a highly optimized JavaScript loop running on Node's main execution thread against a native C++ implementation that leverages **true hardware concurrency (multithreading)** across all available CPU cores.

---

## 📊 Benchmark Results

Running the computation on an **Apple Silicon MacBook Pro (M-Series)** to count total prime numbers up to **200,000,000**:

```text
=== Performance Benchmark: JS vs Native C++ ===
Processing... running algorithms up to 200,000,000

🐢 Running JavaScript computation...
↳ JS Found 11,078,937 primes in 46,315.06ms (~46.3 seconds)

⚡ Running Native C++ computation...
↳ C++ Found 11,078,937 primes in 3,955.22ms (~3.9 seconds)

============ RESULTS ============
C++ was approximately 11.7x faster than highly optimized JS.
```

### 🧠 Why the Gap is So Massive
1. **True Multithreading:** JavaScript is structurally bound to a single execution thread inside the V8 engine. The C++ addon detects hardware capabilities (`std::thread::hardware_concurrency()`) and safely splits the search blocks evenly across all available CPU cores simultaneously.
2. **No JIT Warmup / Context Switching Overhead at Scale:** For smaller inputs, V8's Just-In-Time (JIT) compiler minimizes performance gaps. However, for massive computational loops (like 200 Million), the native machine code execution coupled with multi-core parallelism completely breaks past the limits of pure JavaScript.

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
