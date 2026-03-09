/**
 * =====================================================
 * Redis Stats Manager - إدارة الإحصائيات
 * =====================================================
 * 
 * نظام Redis لتخزين الإحصائيات الحية
 * يعمل مع Redis Cloud أو Redis محلي
 * 
 * @author Senior Blockchain Architect
 */

// =====================================================
// Types
// =====================================================

export interface MinerStats {
  address: string;
  worker: string;
  hashrate: number;
  sharesValid: number;
  sharesInvalid: number;
  lastShare: number;
}

export interface PoolStats {
  hashrate: number;
  miners: number;
  workers: number;
  blocks24h: number;
  lastBlock: number;
  totalShares: number;
}

export interface BlockRecord {
  height: number;
  hash: string;
  reward: number;
  time: number;
  miner: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'orphaned';
}

// =====================================================
// Redis Client Simulation (بدون مكتبة خارجية)
// =====================================================

class RedisClient {
  private data: Map<string, string> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private hashes: Map<string, Map<string, string>> = new Map();
  private lists: Map<string, string[]> = new Map();
  private expires: Map<string, number> = new Map();
  private connected: boolean = false;

  async connect(): Promise<void> {
    this.connected = true;
    console.log('✅ Redis connected (in-memory mode)');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('👋 Redis disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // String operations
  async get(key: string): Promise<string | null> {
    this.checkExpire(key);
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, expireMs?: number): Promise<void> {
    this.data.set(key, value);
    if (expireMs) {
      this.expires.set(key, Date.now() + expireMs);
    }
  }

  async incr(key: string): Promise<number> {
    const val = parseInt(this.data.get(key) || '0') + 1;
    this.data.set(key, val.toString());
    return val;
  }

  async incrby(key: string, amount: number): Promise<number> {
    const val = parseInt(this.data.get(key) || '0') + amount;
    this.data.set(key, val.toString());
    return val;
  }

  async incrbyfloat(key: string, amount: number): Promise<number> {
    const val = parseFloat(this.data.get(key) || '0') + amount;
    this.data.set(key, val.toString());
    return val;
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key)!;
    const added = members.filter(m => !set.has(m)).length;
    members.forEach(m => set.add(m));
    return added;
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) || []);
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size || 0;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    members.forEach(m => {
      if (set.has(m)) {
        set.delete(m);
        removed++;
      }
    });
    return removed;
  }

  // Hash operations
  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const isNew = !this.hashes.get(key)!.has(field);
    this.hashes.get(key)!.set(field, value);
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) || null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash);
  }

  async hincrby(key: string, field: string, amount: number): Promise<number> {
    const current = parseInt(this.hashes.get(key)?.get(field) || '0');
    const newVal = current + amount;
    await this.hset(key, field, newVal.toString());
    return newVal;
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    this.lists.get(key)!.unshift(...values);
    return this.lists.get(key)!.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) || [];
    if (stop === -1) {
      return list.slice(start);
    }
    return list.slice(start, stop + 1);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const list = this.lists.get(key);
    if (list) {
      this.lists.set(key, list.slice(start, stop + 1));
    }
  }

  // Expiration
  async expire(key: string, seconds: number): Promise<number> {
    if (this.data.has(key) || this.sets.has(key) || this.hashes.has(key)) {
      this.expires.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    const expire = this.expires.get(key);
    if (!expire) return -1;
    const ttl = Math.floor((expire - Date.now()) / 1000);
    return ttl > 0 ? ttl : -2;
  }

  // Delete
  async del(key: string): Promise<number> {
    let deleted = 0;
    if (this.data.has(key)) {
      this.data.delete(key);
      deleted++;
    }
    if (this.sets.has(key)) {
      this.sets.delete(key);
      deleted++;
    }
    if (this.hashes.has(key)) {
      this.hashes.delete(key);
      deleted++;
    }
    if (this.lists.has(key)) {
      this.lists.delete(key);
      deleted++;
    }
    this.expires.delete(key);
    return deleted;
  }

  private checkExpire(key: string): void {
    const expire = this.expires.get(key);
    if (expire && Date.now() > expire) {
      this.del(key);
    }
  }
}

// =====================================================
// Redis Stats Manager
// =====================================================

export class RedisStatsManager {
  private client: RedisClient;
  private coin: string;

  constructor(redisUrl: string = 'redis://localhost:6379', coin: string = 'KAS') {
    this.client = new RedisClient();
    this.coin = coin;
    console.log(`📊 Redis Stats Manager initialized for ${coin}`);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  // =====================================================
  // Pool Stats
  // =====================================================

  async updatePoolStats(stats: PoolStats): Promise<void> {
    const key = `pool:${this.coin}:stats`;
    await this.client.hset(key, 'hashrate', stats.hashrate.toString());
    await this.client.hset(key, 'miners', stats.miners.toString());
    await this.client.hset(key, 'workers', stats.workers.toString());
    await this.client.hset(key, 'blocks24h', stats.blocks24h.toString());
    await this.client.hset(key, 'lastBlock', stats.lastBlock.toString());
    await this.client.hset(key, 'totalShares', stats.totalShares.toString());
  }

  async getPoolStats(): Promise<PoolStats | null> {
    const key = `pool:${this.coin}:stats`;
    const data = await this.client.hgetall(key);
    
    if (!data.hashrate) return null;
    
    return {
      hashrate: parseFloat(data.hashrate || '0'),
      miners: parseInt(data.miners || '0'),
      workers: parseInt(data.workers || '0'),
      blocks24h: parseInt(data.blocks24h || '0'),
      lastBlock: parseInt(data.lastBlock || '0'),
      totalShares: parseInt(data.totalShares || '0')
    };
  }

  // =====================================================
  // Miner Stats
  // =====================================================

  async updateMinerHashrate(address: string, worker: string, hashrate: number): Promise<void> {
    const key = `pool:${this.coin}:miners:${address}:${worker}`;
    await this.client.hset(key, 'hashrate', hashrate.toString());
    await this.client.hset(key, 'lastShare', Date.now().toString());
    
    // Add to active miners set
    await this.client.sadd(`pool:${this.coin}:active:miners`, address);
    await this.client.sadd(`pool:${this.coin}:active:${address}:workers`, worker);
  }

  async recordShare(address: string, worker: string, valid: boolean): Promise<void> {
    const key = `pool:${this.coin}:miners:${address}:${worker}`;
    
    if (valid) {
      await this.client.hincrby(key, 'sharesValid', 1);
    } else {
      await this.client.hincrby(key, 'sharesInvalid', 1);
    }
    
    await this.client.hset(key, 'lastShare', Date.now().toString());
  }

  async getMinerStats(address: string): Promise<Record<string, MinerStats>> {
    const workersKey = `pool:${this.coin}:active:${address}:workers`;
    const workers = await this.client.smembers(workersKey);
    
    const result: Record<string, MinerStats> = {};
    
    for (const worker of workers) {
      const key = `pool:${this.coin}:miners:${address}:${worker}`;
      const data = await this.client.hgetall(key);
      
      if (data.hashrate) {
        result[worker] = {
          address,
          worker,
          hashrate: parseFloat(data.hashrate || '0'),
          sharesValid: parseInt(data.sharesValid || '0'),
          sharesInvalid: parseInt(data.sharesInvalid || '0'),
          lastShare: parseInt(data.lastShare || '0')
        };
      }
    }
    
    return result;
  }

  // =====================================================
  // Blocks
  // =====================================================

  async recordBlock(block: BlockRecord): Promise<void> {
    const key = `pool:${this.coin}:blocks`;
    await this.client.lpush(key, JSON.stringify(block));
    await this.client.ltrim(key, 0, 99); // Keep last 100 blocks
    
    // Update 24h block count
    await this.client.hincrby(`pool:${this.coin}:stats`, 'blocks24h', 1);
  }

  async getRecentBlocks(count: number = 50): Promise<BlockRecord[]> {
    const key = `pool:${this.coin}:blocks`;
    const rawBlocks = await this.client.lrange(key, 0, count - 1);
    
    return rawBlocks.map(raw => JSON.parse(raw));
  }

  // =====================================================
  // Round Shares (PPLNS)
  // =====================================================

  async addRoundShare(address: string, shareDiff: number): Promise<void> {
    const key = `pool:${this.coin}:round:shares`;
    await this.client.lpush(key, JSON.stringify({
      address,
      shareDiff,
      time: Date.now()
    }));
    
    // Keep last 10000 shares for PPLNS
    await this.client.ltrim(key, 0, 9999);
  }

  async getRoundShares(): Promise<Array<{ address: string; shareDiff: number; time: number }>> {
    const key = `pool:${this.coin}:round:shares`;
    const rawShares = await this.client.lrange(key, 0, -1);
    
    return rawShares.map(raw => JSON.parse(raw));
  }

  // =====================================================
  // Counter
  // =====================================================

  async incrementCounter(name: string): Promise<number> {
    return this.client.incr(`pool:${this.coin}:counter:${name}`);
  }

  async getCounter(name: string): Promise<number> {
    const val = await this.client.get(`pool:${this.coin}:counter:${name}`);
    return parseInt(val || '0');
  }

  // =====================================================
  // Cleanup
  // =====================================================

  async cleanStaleWorkers(maxAgeMs: number = 300000): Promise<number> {
    const minersKey = `pool:${this.coin}:active:miners`;
    const miners = await this.client.smembers(minersKey);
    let cleaned = 0;
    
    for (const address of miners) {
      const workersKey = `pool:${this.coin}:active:${address}:workers`;
      const workers = await this.client.smembers(workersKey);
      
      for (const worker of workers) {
        const key = `pool:${this.coin}:miners:${address}:${worker}`;
        const lastShare = await this.client.hget(key, 'lastShare');
        
        if (lastShare && Date.now() - parseInt(lastShare) > maxAgeMs) {
          await this.client.srem(workersKey, worker);
          cleaned++;
        }
      }
    }
    
    return cleaned;
  }
}

export default RedisStatsManager;
