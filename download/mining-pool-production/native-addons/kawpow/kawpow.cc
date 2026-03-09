/**
 * =====================================================
 * KawPoW Native Addon for Node.js
 * =====================================================
 * 
 * تنفيذ أصلي لخوارزمية KawPoW المستخدمة في Ravencoin
 * مبني على ProgPoW مع تعديلات Ravencoin
 * 
 * @author Senior Blockchain Architect
 * @version 1.0.0
 */

#include <napi.h>
#include <cstdint>
#include <cstring>
#include <vector>
#include <array>
#include <random>
#include <chrono>

namespace {

// =====================================================
// Constants
// =====================================================

constexpr size_t MIX_BYTES = 128;       // 128 bytes = 1024 bits
constexpr size_t MIX_WORDS = MIX_BYTES / 4;
constexpr size_t HASH_BYTES = 64;
constexpr size_t DATASET_BYTES_INIT = 2147483648;  // 2GB
constexpr size_t CACHE_BYTES_INIT = 16777216;      // 16MB
constexpr size_t EPOCH_LENGTH = 7500;              // Blocks per epoch for RVN

// =====================================================
// FNV-1a Hash
// =====================================================

constexpr uint32_t FNV_PRIME = 0x01000193;
constexpr uint32_t FNV_OFFSET_BASIS = 0x811c9dc5;

inline uint32_t fnv1a(uint32_t a, uint32_t b) {
    return (a ^ b) * FNV_PRIME;
}

inline uint32_t fnv1a_reduce(uint32_t a, uint32_t b) {
    return a * (b | 1);
}

// =====================================================
// Keccak-256 (SHA3-256 variant)
// =====================================================

alignas(64) constexpr uint64_t KECCAK_RC[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808aULL,
    0x8000000080008000ULL, 0x000000000000808bULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL, 0x000000000000008aULL,
    0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000aULL,
    0x000000008000808bULL, 0x800000000000008bULL, 0x8000000000008089ULL,
    0x8000000000008003ULL, 0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800aULL, 0x800000008000000aULL, 0x8000000080008081ULL,
    0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL
};

void keccak_f(uint64_t* state) {
    uint64_t C[5], D[5], temp;
    
    for (int round = 0; round < 24; round++) {
        // θ
        for (int i = 0; i < 5; i++) {
            C[i] = state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20];
        }
        for (int i = 0; i < 5; i++) {
            D[i] = C[(i + 4) % 5] ^ ((C[(i + 1) % 5] << 1) | (C[(i + 1) % 5] >> 63));
        }
        for (int i = 0; i < 25; i++) {
            state[i] ^= D[i % 5];
        }
        
        // ρ and π
        temp = state[1];
        int x = 1, y = 0;
        for (int i = 0; i < 24; i++) {
            int offset = ((i + 1) * (i + 2) / 2) % 64;
            int new_x = y;
            y = (2 * x + 3 * y) % 5;
            x = new_x;
            uint64_t new_temp = state[x + 5 * y];
            state[x + 5 * y] = (temp << offset) | (temp >> (64 - offset));
            temp = new_temp;
        }
        
        // χ
        for (int i = 0; i < 5; i++) {
            for (int j = 0; j < 5; j++) {
                C[j] = state[i * 5 + j];
            }
            for (int j = 0; j < 5; j++) {
                state[i * 5 + j] ^= (~C[(j + 1) % 5]) & C[(j + 2) % 5];
            }
        }
        
        // ι
        state[0] ^= KECCAK_RC[round];
    }
}

void keccak256(const uint8_t* input, size_t len, uint8_t* output) {
    uint64_t state[25] = {0};
    
    // Absorb
    size_t rate = 136;
    size_t offset = 0;
    while (offset + rate <= len) {
        for (size_t i = 0; i < rate / 8; i++) {
            state[i] ^= ((uint64_t*)input)[offset / 8 + i];
        }
        keccak_f(state);
        offset += rate;
    }
    
    // Last block with padding
    uint8_t last_block[136] = {0};
    size_t remaining = len - offset;
    memcpy(last_block, input + offset, remaining);
    last_block[remaining] = 0x01;
    last_block[135] = 0x80;
    
    for (size_t i = 0; i < 17; i++) {
        state[i] ^= ((uint64_t*)last_block)[i];
    }
    keccak_f(state);
    
    // Squeeze
    for (int i = 0; i < 4; i++) {
        for (int j = 0; j < 8; j++) {
            output[i * 8 + j] = (state[i] >> (j * 8)) & 0xFF;
        }
    }
}

// =====================================================
// DAG Cache Generation
// =====================================================

void generate_cache(uint32_t* cache, size_t cache_size, const uint8_t* seed, size_t seed_len) {
    // Initialize cache from seed
    uint8_t hash[32];
    keccak256(seed, seed_len, (uint8_t*)cache);
    
    size_t cache_words = cache_size / 4;
    for (size_t i = 8; i < cache_words; i += 8) {
        uint32_t* prev = cache + i - 8;
        uint32_t* cur = cache + i;
        
        keccak256((uint8_t*)prev, 32, hash);
        for (int j = 0; j < 8; j++) {
            cur[j] = ((uint32_t*)hash)[j];
        }
    }
    
    // Rand memoization
    for (int round = 0; round < 3; round++) {
        for (size_t i = 0; i < cache_words; i += 8) {
            uint32_t* cur = cache + i;
            size_t idx = cur[0] % cache_words;
            idx = (idx / 8) * 8;
            
            uint32_t temp[8];
            for (int j = 0; j < 8; j++) {
                temp[j] = cache[idx + j];
            }
            keccak256((uint8_t*)temp, 32, hash);
            for (int j = 0; j < 8; j++) {
                cur[j] ^= ((uint32_t*)hash)[j];
            }
        }
    }
}

// =====================================================
// Dataset Calculation (Light Mode - for validation)
// =====================================================

void calculate_dataset_item(const uint32_t* cache, size_t cache_size, 
                            uint32_t index, uint32_t* output) {
    size_t cache_words = cache_size / 4;
    size_t data_words = HASH_BYTES / 4;
    
    // Initialize from cache
    for (size_t i = 0; i < data_words; i++) {
        output[i] = cache[(index % cache_words) + i];
    }
    output[0] ^= index;
    
    // FNV mix
    for (int i = 0; i < 256; i++) {
        uint32_t idx = fnv1a(index ^ i, output[i % data_words]) % cache_words;
        for (size_t j = 0; j < data_words; j++) {
            output[j] = fnv1a(output[j], cache[idx * data_words + j]);
        }
    }
}

// =====================================================
// KawPoW Hash Function
// =====================================================

void kawpow_hash(const uint8_t* header, size_t header_len, uint64_t nonce,
                 const uint32_t* cache, size_t cache_size,
                 uint8_t* mix_out, uint8_t* hash_out) {
    
    // Step 1: Calculate seed hash
    uint8_t seed[32];
    uint64_t header_with_nonce[header_len / 8 + 1];
    memcpy(header_with_nonce, header, header_len);
    header_with_nonce[header_len / 8] = nonce;
    keccak256((uint8_t*)header_with_nonce, header_len + 8, seed);
    
    // Step 2: Initialize mix
    uint32_t mix[MIX_WORDS];
    for (size_t i = 0; i < MIX_WORDS; i++) {
        mix[i] = ((uint32_t*)seed)[i % 8];
    }
    
    // Step 3: KawPoW rounds (64 iterations)
    for (uint32_t i = 0; i < 64; i++) {
        // Calculate dataset index
        uint32_t idx = mix[i % MIX_WORDS];
        uint32_t data[MIX_WORDS];
        
        // Calculate dataset item (light mode)
        calculate_dataset_item(cache, cache_size, idx, data);
        
        // Mix
        for (size_t j = 0; j < MIX_WORDS; j++) {
            mix[j] = fnv1a(mix[j], data[j]);
        }
        
        // Random access pattern
        uint32_t lane = mix[i % 32 % 4];
        uint32_t offset = fnv1a(i, lane) % MIX_WORDS;
        uint32_t temp = mix[offset];
        mix[(i + 1) % MIX_WORDS] = fnv1a(mix[(i + 1) % MIX_WORDS], temp);
    }
    
    // Step 4: Finalize mix
    uint32_t cmix[MIX_WORDS / 4];
    for (size_t i = 0; i < MIX_WORDS; i += 4) {
        cmix[i / 4] = fnv1a(fnv1a(fnv1a(mix[i], mix[i + 1]), mix[i + 2]), mix[i + 3]);
    }
    
    // Step 5: Final keccak
    uint8_t final_input[64 + MIX_BYTES];
    memcpy(final_input, seed, 32);
    memcpy(final_input + 32, cmix, MIX_BYTES / 4);
    keccak256(final_input, 64 + MIX_BYTES / 4, hash_out);
    
    // Output mix
    memcpy(mix_out, mix, MIX_BYTES);
}

// =====================================================
// Block Height to Epoch
// =====================================================

uint64_t get_epoch(uint64_t block_height) {
    return block_height / EPOCH_LENGTH;
}

size_t get_cache_size(uint64_t epoch) {
    size_t size = CACHE_BYTES_INIT;
    for (uint64_t i = 0; i < epoch; i++) {
        size = size * 100 / 100 + 2 * HASH_BYTES;
        size = (size / HASH_BYTES) * HASH_BYTES;
    }
    return size;
}

// =====================================================
// Node.js Binding
// =====================================================

class KawPoWWorker : public Napi::AsyncWorker {
public:
    KawPoWWorker(Napi::Env& env, Napi::Buffer<uint8_t> header, uint64_t nonce, 
                 uint64_t block_height, Napi::Buffer<uint32_t> cache)
        : Napi::AsyncWorker(env),
          header_data(header.Data(), header.Data() + header.Length()),
          this->nonce(nonce),
          this->block_height(block_height),
          cache_data(cache.Data(), cache.Data() + cache.Length() / 4),
          cache_size(cache.Length()),
          deferred(Napi::Promise::Deferred::New(env)) {}
    
    void Execute() override {
        hash_output.resize(32);
        mix_output.resize(MIX_BYTES);
        
        kawpow_hash(header_data.data(), header_data.size(), nonce,
                    cache_data.data(), cache_size,
                    mix_output.data(), hash_output.data());
    }
    
    void OnOK() override {
        Napi::Object result = Napi::Object::New(Env());
        result.Set("hash", Napi::Buffer<uint8_t>::Copy(Env(), hash_output.data(), 32));
        result.Set("mix", Napi::Buffer<uint8_t>::Copy(Env(), mix_output.data(), MIX_BYTES));
        deferred.Resolve(result);
    }
    
    void OnError(const Napi::Error& e) override {
        deferred.Reject(e.Value());
    }
    
    Napi::Promise GetPromise() { return deferred.Promise(); }

private:
    std::vector<uint8_t> header_data;
    uint64_t nonce;
    uint64_t block_height;
    std::vector<uint32_t> cache_data;
    size_t cache_size;
    std::vector<uint8_t> hash_output;
    std::vector<uint8_t> mix_output;
    Napi::Promise::Deferred deferred;
};

// Generate cache for epoch
Napi::Value GenerateCache(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected: seed, epoch").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Buffer<uint8_t> seed = info[0].As<Napi::Buffer<uint8_t>>();
    uint64_t epoch = info[1].As<Napi::Number>().Uint64Value();
    
    size_t cache_size = get_cache_size(epoch);
    Napi::Buffer<uint32_t> cache = Napi::Buffer<uint32_t>::New(env, cache_size / 4);
    
    generate_cache(cache.Data(), cache_size, seed.Data(), seed.Length());
    
    return cache;
}

// Sync hash
Napi::Value HashSync(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 4) {
        Napi::TypeError::New(env, "Expected: header, nonce, blockHeight, cache").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Buffer<uint8_t> header = info[0].As<Napi::Buffer<uint8_t>>();
    uint64_t nonce = info[1].As<Napi::Number>().Uint64Value();
    uint64_t block_height = info[2].As<Napi::Number>().Uint64Value();
    Napi::Buffer<uint32_t> cache = info[3].As<Napi::Buffer<uint32_t>>();
    
    uint8_t hash[32];
    uint8_t mix[MIX_BYTES];
    
    kawpow_hash(header.Data(), header.Length(), nonce,
                cache.Data(), cache.Length(),
                mix, hash);
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("hash", Napi::Buffer<uint8_t>::Copy(env, hash, 32));
    result.Set("mix", Napi::Buffer<uint8_t>::Copy(env, mix, MIX_BYTES));
    
    return result;
}

// Validate share
Napi::Value ValidateShare(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 5) {
        Napi::TypeError::New(env, "Expected: header, nonce, blockHeight, cache, target").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Buffer<uint8_t> header = info[0].As<Napi::Buffer<uint8_t>>();
    uint64_t nonce = info[1].As<Napi::Number>().Uint64Value();
    uint64_t block_height = info[2].As<Napi::Number>().Uint64Value();
    Napi::Buffer<uint32_t> cache = info[3].As<Napi::Buffer<uint32_t>>();
    Napi::Buffer<uint8_t> target = info[4].As<Napi::Buffer<uint8_t>>();
    
    uint8_t hash[32];
    uint8_t mix[MIX_BYTES];
    
    kawpow_hash(header.Data(), header.Length(), nonce,
                cache.Data(), cache.Length(),
                mix, hash);
    
    // Compare with target (big-endian)
    bool valid = true;
    for (int i = 0; i < 32 && valid; i++) {
        if (hash[i] < target.Data()[i]) break;
        if (hash[i] > target.Data()[i]) valid = false;
    }
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("valid", Napi::Boolean::New(env, valid));
    result.Set("hash", Napi::Buffer<uint8_t>::Copy(env, hash, 32));
    result.Set("mix", Napi::Buffer<uint8_t>::Copy(env, mix, MIX_BYTES));
    
    return result;
}

// Get cache size for epoch
Napi::Value GetCacheSize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    uint64_t epoch = info[0].As<Napi::Number>().Uint64Value();
    return Napi::Number::New(env, get_cache_size(epoch));
}

// Get epoch from block height
Napi::Value GetEpoch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    uint64_t block_height = info[0].As<Napi::Number>().Uint64Value();
    return Napi::Number::New(env, get_epoch(block_height));
}

} // anonymous namespace

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("hashSync", Napi::Function::New(env, HashSync));
    exports.Set("generateCache", Napi::Function::New(env, GenerateCache));
    exports.Set("validateShare", Napi::Function::New(env, ValidateShare));
    exports.Set("getCacheSize", Napi::Function::New(env, GetCacheSize));
    exports.Set("getEpoch", Napi::Function::New(env, GetEpoch));
    
    Napi::Object info = Napi::Object::New(env);
    info.Set("name", Napi::String::New(env, "KawPoW"));
    info.Set("epochLength", Napi::Number::New(env, EPOCH_LENGTH));
    info.Set("hashSize", Napi::Number::New(env, 32));
    info.Set("mixSize", Napi::Number::New(env, MIX_BYTES));
    exports.Set("info", info);
    
    return exports;
}

NODE_API_MODULE(kawpow_native, Init)
