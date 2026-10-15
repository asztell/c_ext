#include <napi.h>
#include <cmath>
#include <vector>
#include <thread>

// Worker function for a single thread processing a segment of numbers
void countPrimesSegment(int start, int end, int& totalCount) {
    int localCount = 0;
    for (int i = start; i <= end; ++i) {
        if (i <= 1) continue;
        if (i == 2) { localCount++; continue; }
        if (i % 2 == 0) continue;
        
        bool isPrime = true;
        int boundary = std::sqrt(i);
        for (int j = 3; j <= boundary; j += 2) {
            if (i % j == 0) {
                isPrime = false;
                break;
            }
        }
        if (isPrime) localCount++;
    }
    totalCount = localCount;
}

// Multithreaded Orchestrator
Napi::Value CountPrimesWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Fix: Access the first argument by index info[0]
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Fix: Access the first argument by index info[0]
    int limit = info[0].As<Napi::Number>().Int32Value();
    if (limit < 2) return Napi::Number::New(env, 0);

    // Determine hardware concurrency (number of CPU cores available)
    unsigned int numThreads = std::thread::hardware_concurrency();
    if (numThreads == 0) numThreads = 4; // Fallback

    std::vector<std::thread> threads;
    std::vector<int> counts(numThreads, 0);

    // Divide the workload into segments
    int range = limit / numThreads;
    for (unsigned int i = 0; i < numThreads; ++i) {
        int start = i * range + 1;
        int end = (i == numThreads - 1) ? limit : (i + 1) * range;
        
        threads.push_back(std::thread(countPrimesSegment, start, end, std::ref(counts[i])));
    }

    // Wait for all threads to finish execution
    int totalPrimes = 0;
    for (unsigned int i = 0; i < numThreads; ++i) {
        threads[i].join();
        totalPrimes += counts[i];
    }

    return Napi::Number::New(env, totalPrimes);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("countPrimes", Napi::Function::New(env, CountPrimesWrapped));
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
