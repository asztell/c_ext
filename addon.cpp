#include <napi.h>
#include <cmath>

// Helper to check individual primes
bool isPrime(int number) {
    if (number <= 1) return false;
    if (number == 2) return true;
    if (number % 2 == 0) return false;
    int boundary = std::sqrt(number);
    for (int i = 3; i <= boundary; i += 2) {
        if (number % i == 0) return false;
    }
    return true;
}

// Heavy loop counting primes up to a maximum limit
Napi::Value CountPrimesWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Fix 1: Access the first argument via index info[0] to check type
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Fix 2: Cast the specific argument info[0] to a Napi::Number
    int limit = info[0].As<Napi::Number>().Int32Value();
    int count = 0;

    for (int i = 2; i <= limit; ++i) {
        if (isPrime(i)) {
            count++;
        }
    }

    return Napi::Number::New(env, count);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("countPrimes", Napi::Function::New(env, CountPrimesWrapped));
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
