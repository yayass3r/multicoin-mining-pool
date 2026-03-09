/**
 * =====================================================
 * Native Addons Manager
 * =====================================================
 * 
 * يدير تحميل وإدارة الـ Native Addons للخوارزميات الثلاث
 * 
 * @author Senior Blockchain Architect
 */

import path from 'path';
import crypto from 'crypto';

// Types
export interface HashResult {
  hash: Buffer;
  mix?: Buffer;
  valid?: boolean;
  difficulty?: number;
}

export interface AlgorithmInfo {
  name: string;
  hashSize: number;
  mixSize?: number;
  epochLength?: number;
}

// Native module loading
let kHeavyHashNative: any = null;
let kawpowNative: any = null;
let blake3Native: any = null;

// Load native modules
export function loadNativeAddons(): void {
  try {
    kHeavyHashNative = require('../../native-addons/kheavyhash/build/Release/kheavyhash_native.node');
    console.log('✅ kHeavyHash native module loaded');
  } catch (e) {
    console.warn('⚠️ kHeavyHash native module not found, using fallback');
  }

  try {
    kawpowNative = require('../../native-addons/kawpow/build/Release/kawpow_native.node');
    console.log('✅ KawPoW native module loaded');
  } catch (e) {
    console.warn('⚠️ KawPoW native module not found, using fallback');
  }

  try {
    blake3Native = require('../../native-addons/blake3/build/Release/blake3_native.node');
    console.log('✅ Blake3 native module loaded');
  } catch (e) {
    console.warn('⚠️ Blake3 native module not found, using fallback');
  }
}

// =====================================================
// kHeavyHash (Kaspa)
// =====================================================

export class KHeavyHash {
  private static instance: KHeavyHash;
  
  static getInstance(): KHeavyHash {
    if (!KHeavyHash.instance) {
      KHeavyHash.instance = new KHeavyHash();
    }
    return KHeavyHash.instance;
  }

  hash(header: Buffer, nonce?: number): Buffer {
    if (kHeavyHashNative) {
      return kHeavyHashNative.hashSync(header);
    }
    return this.hashFallback(header);
  }

  validateShare(header: Buffer, nonce: number, target: Buffer): HashResult {
    if (kHeavyHashNative) {
      return kHeavyHashNative.validateShare(header, nonce, target);
    }
    
    const hash = this.hashFallback(header);
    const valid = this.compareHashToTarget(hash, target);
    return { hash, valid };
  }

  private hashFallback(header: Buffer): Buffer {
    return crypto.createHash('sha256').update(header).digest();
  }

  private compareHashToTarget(hash: Buffer, target: Buffer): boolean {
    for (let i = 0; i < 32; i++) {
      if (hash[i] < target[i]) return true;
      if (hash[i] > target[i]) return false;
    }
    return true;
  }

  getInfo(): AlgorithmInfo {
    return { name: 'kHeavyHash', hashSize: 32 };
  }
}

// =====================================================
// KawPoW (Ravencoin)
// =====================================================

export class KawPoW {
  private static instance: KawPoW;
  private cache: Map<number, Buffer> = new Map();

  static getInstance(): KawPoW {
    if (!KawPoW.instance) {
      KawPoW.instance = new KawPoW();
    }
    return KawPoW.instance;
  }

  getCache(epoch: number): Buffer | undefined {
    return this.cache.get(epoch);
  }

  hash(header: Buffer, nonce: number, blockHeight: number, cache: Buffer): HashResult {
    if (kawpowNative) {
      return kawpowNative.hashSync(header, nonce, blockHeight, cache);
    }
    return {
      hash: crypto.createHash('sha256').update(header).digest(),
      mix: Buffer.alloc(128)
    };
  }

  validateShare(header: Buffer, nonce: number, blockHeight: number, 
                cache: Buffer, target: Buffer): HashResult {
    if (kawpowNative) {
      return kawpowNative.validateShare(header, nonce, blockHeight, cache, target);
    }
    const hash = crypto.createHash('sha256').update(header).digest();
    return { hash, valid: this.compareHashToTarget(hash, target) };
  }

  getEpoch(blockHeight: number): number {
    return Math.floor(blockHeight / 7500);
  }

  private compareHashToTarget(hash: Buffer, target: Buffer): boolean {
    for (let i = 0; i < 32; i++) {
      if (hash[i] < target[i]) return true;
      if (hash[i] > target[i]) return false;
    }
    return true;
  }
}

// =====================================================
// Blake3 (Alephium)
// =====================================================

export class Blake3 {
  private static instance: Blake3;

  static getInstance(): Blake3 {
    if (!Blake3.instance) {
      Blake3.instance = new Blake3();
    }
    return Blake3.instance;
  }

  hash(header: Buffer, nonce?: number): Buffer {
    if (blake3Native) {
      return blake3Native.hashSync(header, nonce || 0);
    }
    return crypto.createHash('sha256').update(header).digest();
  }

  validateShare(header: Buffer, nonce: number, target: Buffer): HashResult {
    if (blake3Native) {
      return blake3Native.validateShare(header, nonce, target);
    }
    const hash = this.hash(header, nonce);
    return { hash, valid: this.compareHashToTarget(hash, target) };
  }

  private compareHashToTarget(hash: Buffer, target: Buffer): boolean {
    for (let i = 0; i < 32; i++) {
      if (hash[i] < target[i]) return true;
      if (hash[i] > target[i]) return false;
    }
    return true;
  }
}

// Initialize on load
loadNativeAddons();
