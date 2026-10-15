#include <napi.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <functional>
#include <limits>
#include <string>
#include <thread>
#include <vector>

namespace {

// Odd numbers represented per segment. 128 KiB of flags keeps the working set
// inside L2 instead of streaming a limit/2 sized buffer through main memory.
constexpr size_t kSegmentOdds = static_cast<size_t>(1) << 17;

// Spawning a thread costs on the order of 100us. Below this much work per
// thread the spawn overhead dominates the actual computation.
constexpr int32_t kMinWorkPerThread = 1 << 22;

// The JS-visible ceiling. Kept in sync with index.ts via the exported
// `maxLimit` so the two can never drift apart.
constexpr int32_t kMaxLimit = std::numeric_limits<int32_t>::max();

// Base primes up to sqrt(limit), odd only (2 is always counted separately).
std::vector<uint32_t> BuildBasePrimes(uint32_t root) {
  std::vector<uint8_t> composite(static_cast<size_t>(root) + 1, 0);
  for (uint32_t i = 3; i <= root; i += 2) {
    if (composite[i]) continue;
    for (int64_t j = static_cast<int64_t>(i) * i; j <= root; j += 2LL * i) {
      composite[static_cast<size_t>(j)] = 1;
    }
  }
  std::vector<uint32_t> primes;
  primes.reserve(root / 3);
  for (uint32_t i = 3; i <= root; i += 2) {
    if (!composite[i]) primes.push_back(i);
  }
  return primes;
}

// Counts odd primes in [lo, hi]. Both bounds must be odd.
// `scratch` is reused across segments to avoid re-allocating per segment.
int64_t CountSegment(int64_t lo, int64_t hi, const std::vector<uint32_t>& base,
                     std::vector<uint8_t>& scratch) {
  if (lo > hi) return 0;
  std::fill(scratch.begin(), scratch.end(), 0);

  for (const uint32_t raw : base) {
    const int64_t p = static_cast<int64_t>(raw);
    if (p * p > hi) break;
    // 64-bit throughout: p*p and the first-multiple product both overflow int32.
    int64_t first = std::max(p * p, ((lo + p - 1) / p) * p);
    if ((first & 1) == 0) first += p;  // only odd multiples are represented
    for (int64_t j = first; j <= hi; j += 2 * p) {
      scratch[static_cast<size_t>((j - lo) / 2)] = 1;
    }
  }

  size_t valid = static_cast<size_t>((hi - lo) / 2 + 1);
  if (valid > scratch.size()) valid = scratch.size();

  int64_t count = 0;
  for (size_t i = 0; i < valid; ++i) {
    if (!scratch[i]) ++count;
  }
  return count;
}

void CountSegments(size_t begin, size_t end, int64_t lastOdd,
                   const std::vector<uint32_t>& base, std::vector<uint8_t>& scratch,
                   std::vector<int64_t>& counts) {
  const int64_t span = 2 * static_cast<int64_t>(kSegmentOdds);
  for (size_t s = begin; s < end; ++s) {
    const int64_t lo = 3 + 2 * static_cast<int64_t>(s) * static_cast<int64_t>(kSegmentOdds);
    int64_t hi = lo + span - 2;
    // Clamp down, never up: rounding an even limit up would count limit+1.
    if (hi > lastOdd) hi = lastOdd;
    counts[s] = CountSegment(lo, hi, base, scratch);
  }
}

int64_t CountPrimes(int32_t limit) {
  if (limit < 2) return 0;

  const int64_t lastOdd = (limit & 1) ? static_cast<int64_t>(limit)
                                      : static_cast<int64_t>(limit) - 1;
  const uint32_t root = static_cast<uint32_t>(std::sqrt(static_cast<double>(limit)));
  const std::vector<uint32_t> base = BuildBasePrimes(root);

  const size_t segmentCount =
      static_cast<size_t>((lastOdd - 3) / (2 * static_cast<int64_t>(kSegmentOdds))) + 1;
  std::vector<int64_t> counts(segmentCount, 0);

  unsigned int threads = std::thread::hardware_concurrency();
  if (threads == 0) threads = 4;  // hardware_concurrency may report 0
  const unsigned int byWorkload =
      static_cast<unsigned int>(limit / kMinWorkPerThread);
  threads = std::min<unsigned int>(threads, std::max(1u, byWorkload));
  threads = std::min<unsigned int>(threads, static_cast<unsigned int>(segmentCount));

  if (threads <= 1) {
    // Small inputs run inline; spawning a thread would cost more than the work.
    std::vector<uint8_t> scratch(kSegmentOdds);
    CountSegments(0, segmentCount, lastOdd, base, scratch, counts);
  } else {
    std::vector<std::vector<uint8_t>> scratch(threads);
    for (auto& buf : scratch) buf.assign(kSegmentOdds, 0);

    const size_t chunk = (segmentCount + threads - 1) / threads;
    std::vector<std::thread> pool;
    pool.reserve(threads);  // never reallocate a vector holding live threads
    for (unsigned int t = 0; t < threads; ++t) {
      const size_t begin = std::min(segmentCount, static_cast<size_t>(t) * chunk);
      const size_t end = std::min(segmentCount, begin + chunk);
      if (begin >= end) continue;
      pool.emplace_back(CountSegments, begin, end, lastOdd, std::cref(base),
                        std::ref(scratch[t]), std::ref(counts));
    }
    for (auto& thread : pool) thread.join();
  }

  int64_t total = 1;  // the prime 2
  for (const int64_t c : counts) total += c;
  return total;
}

Napi::Value CountPrimesWrapped(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Read as double first. Int32Value() silently wraps out-of-range and
  // non-integral inputs, which produced confidently wrong answers.
  const double raw = info[0].As<Napi::Number>().DoubleValue();
  if (!std::isfinite(raw) || raw != std::floor(raw)) {
    Napi::TypeError::New(env, "limit must be a finite integer")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  if (raw < 2 || raw > static_cast<double>(kMaxLimit)) {
    Napi::RangeError::New(env, "limit must be between 2 and " + std::to_string(kMaxLimit))
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  // N-API builds compile with -fno-exceptions (node-gyp forces it via
  // GCC_ENABLE_CPP_EXCEPTIONS=NO on macOS), so std::thread's system_error
  // cannot be caught here. Failure is made unreachable instead: the thread
  // count is clamped well below any OS limit, and the pool is reserved so it
  // is never reallocated while holding live threads.
  return Napi::Number::New(env, static_cast<double>(CountPrimes(static_cast<int32_t>(raw))));
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("countPrimes", Napi::Function::New(env, CountPrimesWrapped));
  exports.Set("maxLimit", Napi::Number::New(env, kMaxLimit));
  return exports;
}

}  // namespace

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)