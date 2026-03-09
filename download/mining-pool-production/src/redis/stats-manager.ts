/**
 * =====================================================
 * Redis Stats Manager - إحصائيات حقيقية
 * =====================================================
 * 
 * نظام متكامل لإدارة الإحصائيات الحقيقية
 * حساب معدل الهاش من الشيرات الصالحة
 * 
 * @author Senior Blockchain Architect
 */

import Redis from 'ioredis';
import EventEmitter from 'events';

// =====================================================
// Types
// =====================================================

export interface MinerStats {
  workerName: string;
  address: string;
  coin: string;
  hashrate: number;           // H/s
  hashrate24h: number;        // 24h average
  sharesPerMinute: number;
  validShares: number;
  invalidShares: number;
  staleShares: number;
  lastShareTime: number;
  totalPaid: number;
  pendingBalance: number;
  difficulty: number;
}

export interface PoolStats {
  coin: string;
  totalHashrate: number;
  totalMiners: number;
  totalWorkers: number;
  validShares: number;
  invalidShares: number;
  blocksFound: number;
  blocksPending: number;
  lastBlockTime: number;
  difficulty: number;
  networkHashrate: number;
  blockHeight: number;
}

export interface ShareRecord {
  workerName: string;
  coin: string;
  difficulty: number;
  timestamp: number;
  valid: boolean;
  isBlock: boolean;
  blockHash?: string;
}

// =====================================================
// Redis Keys
// =====================================================

const REDIS_KEYS = {
  // Miner stats
  minerHashrate: (coin: string, worker: string) => `pool:${coin}:miner:${worker}:hashrate`,
  minerShares: (coin: string, worker: string) => `pool:${coin}:miner:${worker}:shares`,
  minerLastShare: (coin: string, worker: string) => `pool:${coin}:miner:${worker}:lastshare`,
  minerDifficulty: (coin: string, worker: string) => `pool:${coin}:miner:${worker}:difficulty`,
  
  // Pool stats
  poolHashrate: (coin: string) => `pool:${coin}:hashrate`,
  poolMiners: (coin: string) => `pool:${coin}:miners`,
  poolBlocks: (coin: string) => `pool:${coin}:blocks`,
  poolShares: (coin: string) => `pool:${coin}:shares:total`,
  
  // Time series
  sharesTS: (coin: string) => `pool:${coin}:shares:ts`,
  hashrateTS: (coin: string) => `pool:${coin}:hashrate:ts`,
  
  // Balances
  balance: (coin: string, address: string) => `pool:${coin}:balance:${address}`,
  paid: (coin: string, address: string) => `pool:${coin}:paid:${address}`,
  
  // Blocks
  blocksPending: (coin: string) => `pool:${coin}:blocks:pending`,
  blocksConfirmed: (coin: string) => `pool:${coin}:blocks:confirmed`,
};

// =====================================================
// Stats Manager
// =====================================================

export class RedisStatsManager extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;
  private readonly SHARE_TTL = 600; // 10 minutes
  private readonly HASHRATE_WINDOW = 600; // 10 minutes in seconds
  
  private connected: boolean = false;

  constructor(redisUrl: string = 'redis://localhost:6379') {
    super();
    
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true
    });
    
    this.subscriber = new Redis(redisUrl);
    
    this.redis.on('connect', () => {
      this.connected = true;
      console.log('✅ Connected to Redis');
      this.emit('connected');
    });
    
    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
      this.emit('error', err);
    });
    
    this.redis.on('close', () => {
      this.connected = false;
      console.log('⚠️ Redis connection closed');
      this.emit('disconnected');
    });
  }

  // =====================================================
  // Share Recording
  // =====================================================

  /**
   * تسجيل شير جديد
   */
  async recordShare(
    coin: string,
    workerName: string,
    address: string,
    difficulty: number,
    valid: boolean,
    isBlock: boolean = false,
    blockHash?: string
  ): Promise<void> {
    const timestamp = Date.now();
    const score = Math.floor(timestamp / 1000);
    
    // تسجيل الشير في Time Series
    const shareData = JSON.stringify({
      workerName,
      address,
      difficulty,
      valid,
      isBlock,
      blockHash,
      timestamp
    });

    const pipeline = this.redis.pipeline();
    
    // Add to time series (sorted set)
    pipeline.zadd(
      REDIS_KEYS.sharesTS(coin),
      score,
      shareData
    );
    
    // Remove old shares (older than TTL)
    const cutoff = score - this.SHARE_TTL;
    pipeline.zremrangebyscore(REDIS_KEYS.sharesTS(coin), '-inf', cutoff);
    
    // Update miner stats
    pipeline.hincrby(REDIS_KEYS.minerShares(coin, workerName), valid ? 'valid' : 'invalid', 1);
    pipeline.hset(REDIS_KEYS.minerLastShare(coin, workerName), 'timestamp', timestamp);
    pipeline.hset(REDIS_KEYS.minerDifficulty(coin, workerName), 'difficulty', difficulty);
    
    // Update pool totals
    if (valid) {
      pipeline.hincrby(REDIS_KEYS.poolShares(coin), 'valid', 1);
      pipeline.hincrby(REDIS_KEYS.poolShares(coin), 'difficulty', difficulty);
    } else {
      pipeline.hincrby(REDIS_KEYS.poolShares(coin), 'invalid', 1);
    }
    
    // Update active miners set
    pipeline.zadd(REDIS_KEYS.poolMiners(coin), score, workerName);
    pipeline.zremrangebyscore(REDIS_KEYS.poolMiners(coin), '-inf', cutoff);
    
    // If it's a block
    if (isBlock && blockHash) {
      pipeline.hset(REDIS_KEYS.blocksPending(coin), blockHash, JSON.stringify({
        height: 0,
        reward: 0,
        time: timestamp,
        worker: workerName,
        address
      }));
    }
    
    await pipeline.exec();
    
    // Publish share event
    await this.redis.publish(`pool:${coin}:share`, JSON.stringify({
      worker: workerName,
      difficulty,
      valid,
      isBlock,
      timestamp
    }));
    
    // Recalculate hashrate
    await this.calculateHashrate(coin, workerName);
  }

  /**
   * حساب معدل الهاش من الشيرات
   * 
   * المعادلة: Hashrate = Difficulty × Shares / Time
   */
  async calculateHashrate(coin: string, workerName: string): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - this.HASHRATE_WINDOW;
    
    // جلب الشيرات خلال آخر 10 دقائق
    const shares = await this.redis.zrangebyscore(
      REDIS_KEYS.sharesTS(coin),
      cutoff,
      now
    );
    
    let totalDifficulty = 0;
    let shareCount = 0;
    
    for (const share of shares) {
      try {
        const data = JSON.parse(share);
        if (data.workerName === workerName && data.valid) {
          totalDifficulty += data.difficulty;
          shareCount++;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
    
    // حساب معدل الهاش
    // Hashrate = Difficulty × 2^32 / Time
    // للتعدين: hashrate = difficulty * shares / window_seconds
    const hashrate = (totalDifficulty * 4294967296) / this.HASHRATE_WINDOW;
    
    // حفظ في Redis
    await this.redis.hset(REDIS_KEYS.minerHashrate(coin, workerName), {
      hashrate: Math.floor(hashrate),
      shares: shareCount,
      lastUpdate: now
    });
    
    return hashrate;
  }

  /**
   * حساب معدل هاش الحوض الكلي
   */
  async calculatePoolHashrate(coin: string): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - this.HASHRATE_WINDOW;
    
    const shares = await this.redis.zrangebyscore(
      REDIS_KEYS.sharesTS(coin),
      cutoff,
      now
    );
    
    let totalDifficulty = 0;
    
    for (const share of shares) {
      try {
        const data = JSON.parse(share);
        if (data.valid) {
          totalDifficulty += data.difficulty;
        }
      } catch (e) {
        // Skip
      }
    }
    
    const hashrate = (totalDifficulty * 4294967296) / this.HASHRATE_WINDOW;
    
    // Save to Redis
    await this.redis.hset(REDIS_KEYS.poolHashrate(coin), {
      hashrate: Math.floor(hashrate),
      lastUpdate: now
    });
    
    // Add to time series
    await this.redis.zadd(REDIS_KEYS.hashrateTS(coin), now, JSON.stringify({
      hashrate: Math.floor(hashrate),
      timestamp: now
    }));
    
    return hashrate;
  }

  // =====================================================
  // Get Stats
  // =====================================================

  /**
   * جلب إحصائيات المعدن
   */
  async getMinerStats(coin: string, workerName: string): Promise<MinerStats | null> {
    const [hashrateData, sharesData, lastShare, difficulty] = await Promise.all([
      this.redis.hgetall(REDIS_KEYS.minerHashrate(coin, workerName)),
      this.redis.hgetall(REDIS_KEYS.minerShares(coin, workerName)),
      this.redis.hget(REDIS_KEYS.minerLastShare(coin, workerName), 'timestamp'),
      this.redis.hget(REDIS_KEYS.minerDifficulty(coin, workerName), 'difficulty')
    ]);
    
    if (!Object.keys(sharesData).length && !Object.keys(hashrateData).length) {
      return null;
    }
    
    const hashrate = parseInt(hashrateData.hashrate || '0');
    const validShares = parseInt(sharesData.valid || '0');
    const invalidShares = parseInt(sharesData.invalid || '0');
    const windowShares = parseInt(hashrateData.shares || '0');
    
    return {
      workerName,
      address: '', // Loaded separately
      coin,
      hashrate,
      hashrate24h: hashrate, // Simplified
      sharesPerMinute: windowShares / 10,
      validShares,
      invalidShares,
      staleShares: parseInt(sharesData.stale || '0'),
      lastShareTime: parseInt(lastShare || '0'),
      totalPaid: 0,
      pendingBalance: 0,
      difficulty: parseFloat(difficulty || '1')
    };
  }

  /**
   * جلب جميع المعدنين النشطين
   */
  async getActiveMiners(coin: string): Promise<MinerStats[]> {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - this.HASHRATE_WINDOW;
    
    // Get active workers from sorted set
    const workers = await this.redis.zrangebyscore(
      REDIS_KEYS.poolMiners(coin),
      cutoff,
      now
    );
    
    const stats: MinerStats[] = [];
    
    for (const worker of workers) {
      const minerStats = await this.getMinerStats(coin, worker);
      if (minerStats) {
        stats.push(minerStats);
      }
    }
    
    return stats;
  }

  /**
   * جلب إحصائيات الحوض
   */
  async getPoolStats(coin: string): Promise<PoolStats> {
    const [hashrateData, sharesData, blocksCount, miners] = await Promise.all([
      this.redis.hgetall(REDIS_KEYS.poolHashrate(coin)),
      this.redis.hgetall(REDIS_KEYS.poolShares(coin)),
      this.redis.hlen(REDIS_KEYS.blocksPending(coin)),
      this.redis.zcard(REDIS_KEYS.poolMiners(coin))
    ]);
    
    const hashrate = parseInt(hashrateData.hashrate || '0');
    const validShares = parseInt(sharesData.valid || '0');
    const invalidShares = parseInt(sharesData.invalid || '0');
    
    return {
      coin,
      totalHashrate: hashrate,
      totalMiners: miners,
      totalWorkers: miners,
      validShares,
      invalidShares,
      blocksFound: 0, // From separate counter
      blocksPending: blocksCount,
      lastBlockTime: 0,
      difficulty: 0,
      networkHashrate: 0,
      blockHeight: 0
    };
  }

  // =====================================================
  // Balance Management
  // =====================================================

  /**
   * تحديث رصيد المعدن
   */
  async updateBalance(
    coin: string,
    address: string,
    amount: number,
    isReward: boolean = true
  ): Promise<number> {
    const key = REDIS_KEYS.balance(coin, address);
    
    let newBalance: number;
    
    if (isReward) {
      newBalance = await this.redis.incrbyfloat(key, amount);
    } else {
      newBalance = await this.redis.incrbyfloat(key, -amount);
    }
    
    return newBalance;
  }

  /**
   * جلب رصيد المعدن
   */
  async getBalance(coin: string, address: string): Promise<number> {
    const balance = await this.redis.get(REDIS_KEYS.balance(coin, address));
    return parseFloat(balance || '0');
  }

  /**
   * تسجيل دفعة
   */
  async recordPayout(
    coin: string,
    address: string,
    amount: number,
    txHash: string
  ): Promise<void> {
    const timestamp = Date.now();
    
    // Deduct from balance
    await this.updateBalance(coin, address, amount, false);
    
    // Add to paid total
    await this.redis.incrbyfloat(REDIS_KEYS.paid(coin, address), amount);
    
    // Store payout record
    await this.redis.lpush(`pool:${coin}:payouts:${address}`, JSON.stringify({
      amount,
      txHash,
      timestamp
    }));
    
    // Keep last 100 payouts
    await this.redis.ltrim(`pool:${coin}:payouts:${address}`, 0, 99);
  }

  // =====================================================
  // Blocks
  // =====================================================

  /**
   * تسجيل كتلة جديدة
   */
  async recordBlock(
    coin: string,
    height: number,
    hash: string,
    reward: number,
    workerName: string,
    address: string
  ): Promise<void> {
    const timestamp = Date.now();
    
    await this.redis.hset(REDIS_KEYS.blocksPending(coin), hash, JSON.stringify({
      height,
      reward,
      worker: workerName,
      address,
      timestamp
    }));
  }

  /**
   * تأكيد كتلة
   */
  async confirmBlock(coin: string, hash: string): Promise<void> {
    const blockData = await this.redis.hget(REDIS_KEYS.blocksPending(coin), hash);
    
    if (blockData) {
      // Move to confirmed
      await this.redis.hset(REDIS_KEYS.blocksConfirmed(coin), hash, blockData);
      await this.redis.hdel(REDIS_KEYS.blocksPending(coin), hash);
      
      // Update miner balance
      const block = JSON.parse(blockData);
      await this.updateBalance(coin, block.address, block.reward);
    }
  }

  /**
   * كتلة غير صالحة (orphan)
   */
  async orphanBlock(coin: string, hash: string): Promise<void> {
    await this.redis.hdel(REDIS_KEYS.blocksPending(coin), hash);
  }

  // =====================================================
  // Utility
  // =====================================================

  /**
   * تنظيف البيانات القديمة
   */
  async cleanup(coin: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - this.SHARE_TTL;
    
    // Clean old shares
    await this.redis.zremrangebyscore(REDIS_KEYS.sharesTS(coin), '-inf', cutoff);
    
    // Clean inactive miners
    await this.redis.zremrangebyscore(REDIS_KEYS.poolMiners(coin), '-inf', cutoff);
  }

  /**
   * إغلاق الاتصال
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    await this.subscriber.quit();
    this.connected = false;
    this.emit('disconnected');
  }

  /**
   * حالة الاتصال
   */
  isConnected(): boolean {
    return this.connected;
  }
}

export default RedisStatsManager;
