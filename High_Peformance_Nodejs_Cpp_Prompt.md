# High-Performance Node.js Native Extension Prompt

Create a high-performance Node.js native extension benchmark using **TypeScript (modern ESM)** and **Node-API (`node-addon-api`)** for the following computational task: **[INSERT YOUR WORKLOAD HERE, e.g., image manipulation, matrix multiplication, cryptography]**.

To maximize hardware efficiency and ensure a fair architectural benchmark, follow these engineering guidelines:

### 1. Algorithmic Parity
* Provide both the C++ addon and TypeScript implementations using the **exact same optimal algorithm**. 
* Use identical memory layouts (e.g., using low-level typed buffers like `Uint8Array` in JavaScript) so the benchmark strictly measures runtime compilation and concurrency, rather than comparing a fast algorithm against a slow one.

### 2. Hardware & Cache Optimization
* Structuralize the data flow for CPU cache locality. 
* Segment the workload into explicit chunk sizes that fit entirely inside the L2/L3 cache bounds to eliminate high-latency main memory streaming.

### 3. Smart Concurrency & Overhead Safety
* Leverage native C++ multithreading (e.g., `std::thread`).
* Implement a minimum workload threshold configuration so small inputs execute synchronously inline, avoiding cases where thread-spawning overhead dominates execution time.

### 4. Defensive System Safety
* Because Node-API compiles with native exceptions disabled (`-fno-exceptions`), perform rigorous input type and bounds checking on the C++ boundary (evaluating inputs as `double` first) to prevent silent integer wrapping or overflows.
* Pre-allocate memory structures and pool buffers safely to avoid crash conditions or segmentation faults.

### 5. Modern Stack Setup
* Configure the setup for the latest TypeScript specifications using `NodeNext` module resolution rules.
* Use `tsx` as the loader framework to execute the files directly without runtime import errors.
