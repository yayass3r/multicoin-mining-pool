/**
 * =====================================================
 * ⛏️ Production Mining Engine - محرك التعدين الإنتاجي
 * =====================================================
 * 
 * محرك تعدين حقيقي بدون محاكاة:
 * - يستقبل الشيرات من خوادم Stratum
 * - يخزن الإحصائيات في Redis
 * - يكتشف الكتل ويرسلها للشبكة
 * 
 * @author Lead Blockchain Architect
 */

import { EventEmitter } from 'events';
import { createClient } from 'redis';
import { KaspaStratumServer } from './stratum/kaspa-stratum';
import { RavencoinStratumServer } from './stratum/ravencoin-stratum';
import { AlephiumStratumServer } from './stratum/alephium-stratum';
import { KaspaRPCClient } from '../rpc/kaspa-rpc';
import { Algorithms } from './addons';

// =====================================================
// Types
// =====================================================

interface MiningConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  coins: {
    KAS: {
      enabled: boolean;
      stratumPort: number;
      rpcHost: string;
      rpcPort: number;
      wallet: string;
      minPayout: number;
    };
    RVN: {
      enabled: boolean;
      stratumPort: number;
      rpcHost: string;
      rpcPort: number;
      wallet: string;
      minPayout: number;
    };
    ALPH: {
      enabled: boolean;
      stratumPort: number;
      rpcHost: string;
      rpcPort: number;
      wallet: string;
      minPayout: number;
    };
  };
  poolFee: number;
}

interface ValidShare {
  coin: string;
  miner: string;
  worker: string;
  jobId: string;
  nonce: string;
  difficulty: number;
  isBlock: boolean;
  timestamp: number;
}

interface MinerStats {
  address: string;
  worker: string;
  coin: string;
  hashrate: number;
  validShares: number;
  invalidShares: number;
  balance: number;
  lastShare: number;
}

interface PoolStats {
  coin: string;
  hashrate: number;
  miners: number;
  workers: number;
  blocks24h: number;
  totalShares: number;
  validShares: number;
  invalidShares: number;
  difficulty: number;
  networkHashrate: number;
  blockHeight: number;
}

// =====================================================
// Mining Engine
// =====================================================

export class MiningEngine extends EventEmitter {
  private config: MiningConfig;
  private redis: any;
  private stratumServers: Map<string, any> = new Map();
  private rpcClients: Map<string, any> = new Map();
  private isRunning: boolean = false;
  private statsInterval: NodeJS.Timeout | null = null;

  // إحصائيات حقيقية
  private stats: Map<string, PoolStats> = new Map();
  private minerStats: Map<string, MinerStats> = new Map();
  private shareBuffer: ValidShare[] = [];
  private blockRewards: Map<string, number> = new Map();

  constructor(config: MiningConfig) {
    super();
    this.config = config;
  }

  // =====================================================
  // Start Engine
  // =====================================================

  async start(): Promise<void> {
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('⛏️  Production Mining Engine Starting...');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('');

    // 1. الاتصال بـ Redis
    await this.connectRedis();

    // 2. تحميل الإحصائيات المحفوظة
    await this.loadStats();

    // 3. بدء خوادم Stratum
    await this.startStratumServers();

    // 4. الاتصال بالعُقد
    await this.connectNodes();

    // 5. بدء حلقات التحديث
    this.startStatsLoop();
    this.startShareProcessor();

    this.isRunning = true;
    console.log('');
    console.log('✅ Mining Engine Started!');
    console.log('');
  }

  // =====================================================
  // Redis Connection
  // =====================================================

  private async connectRedis(): Promise<void> {
    console.log('📡 Connecting to Redis...');
    
    this.redis = createClient({
      socket: {
        host: this.config.redis.host,
        port: this.config.redis.port
      },
      password: this.config.redis.password
    });

    await this.redis.connect();
    console.log('✅ Redis connected');
  }

  private async loadStats(): Promise<void> {
    console.log('📊 Loading saved statistics...');

    // تحميل إحصائيات الحوض
    for (const coin of ['KAS', 'RVN', 'ALPH']) {
      const savedStats = await this.redis.get(`pool:${coin}:stats`);
      if (savedStats) {
        this.stats.set(coin, JSON.parse(savedStats));
      } else {
        this.stats.set(coin, {
          coin,
          hashrate: 0,
          miners: 0,
          workers: 0,
          blocks24h: 0,
          totalShares: 0,
          validShares: 0,
          invalidShares: 0,
          difficulty: 0,
          networkHashrate: 0,
          blockHeight: 0
        });
      }
    }

    console.log('✅ Statistics loaded');
  }

  // =====================================================
  // Stratum Servers
  // =====================================================

  private async startStratumServers(): Promise<void> {
    console.log('🔌 Starting Stratum servers...');

    // Kaspa
    if (this.config.coins.KAS.enabled) {
      const kasStratum = new KaspaStratumServer({
        port: this.config.coins.KAS.stratumPort,
        poolAddress: this.config.coins.KAS.wallet,
        defaultDifficulty: 16384,
        minDifficulty: 256,
        maxDifficulty: 4294967296,
        rpcHost: this.config.coins.KAS.rpcHost,
        rpcPort: this.config.coins.KAS.rpcPort,
        rpcUser: '',
        rpcPassword: ''
      });

      // الاستماع للشيرات
      kasStratum.on('validShare', (share: ValidShare) => {
        this.processValidShare(share);
      });

      kasStratum.on('blockAccepted', (data: any) => {
        this.handleBlockFound('KAS', data);
      });

      await kasStratum.start();
      this.stratumServers.set('KAS', kasStratum);
    }

    // Ravencoin
    if (this.config.coins.RVN.enabled) {
      const rvnStratum = new RavencoinStratumServer(
        this.config.coins.RVN.stratumPort,
        this.config.coins.RVN.wallet
      );

      rvnStratum.on('validShare', (share: ValidShare) => {
        this.processValidShare(share);
      });

      rvnStratum.on('blockAccepted', (data: any) => {
        this.handleBlockFound('RVN', data);
      });

      await rvnStratum.start();
      this.stratumServers.set('RVN', rvnStratum);
    }

    // Alephium
    if (this.config.coins.ALPH.enabled) {
      const alphStratum = new AlephiumStratumServer(
        this.config.coins.ALPH.stratumPort,
        this.config.coins.ALPH.wallet
      );

      alphStratum.on('validShare', (share: ValidShare) => {
        this.processValidShare(share);
      });

      alphStratum.on('blockAccepted', (data: any) => {
        this.handleBlockFound('ALPH', data);
      });

      await alphStratum.start();
      this.stratumServers.set('ALPH', alphStratum);
    }
  }

  // =====================================================
  // RPC Node Connections
  // =====================================================

  private async connectNodes(): Promise<void> {
    console.log('🔗 Connecting to blockchain nodes...');

    // Kaspa
    if (this.config.coins.KAS.enabled) {
      try {
        const kasRpc = new KaspaRPCClient({
          host: this.config.coins.KAS.rpcHost,
          port: this.config.coins.KAS.rpcPort
        });
        await kasRpc.connect();
        this.rpcClients.set('KAS', kasRpc);
        console.log('   ✅ Kaspa node connected');
      } catch (e) {
        console.log('   ⚠️ Kaspa node connection failed');
      }
    }

    // RVN and ALPH nodes would be similar
  }

  // =====================================================
  // Share Processing - الحقيقي بدون محاكاة
  // =====================================================

  private processValidShare(share: ValidShare): void {
    // إضافة للـ buffer
    this.shareBuffer.push(share);

    // تحديث إحصائيات المعدّن
    this.updateMinerStats(share);

    // تحديث إحصائيات الحوض
    const poolStats = this.stats.get(share.coin);
    if (poolStats) {
      poolStats.validShares++;
      poolStats.totalShares++;
    }

    // إذا كان كتلة
    if (share.isBlock) {
      this.handleBlockFound(share.coin, share);
    }

    this.emit('validShare', share);
  }

  private updateMinerStats(share: ValidShare): void {
    const key = `${share.coin}:${share.miner}:${share.worker}`;
    
    let stats = this.minerStats.get(key);
    if (!stats) {
      stats = {
        address: share.miner,
        worker: share.worker,
        coin: share.coin,
        hashrate: 0,
        validShares: 0,
        invalidShares: 0,
        balance: 0,
        lastShare: Date.now()
      };
      this.minerStats.set(key, stats);
    }

    stats.validShares++;
    stats.lastShare = Date.now();

    // حساب الـ hashrate من معدل الشيرات
    stats.hashrate = this.calculateMinerHashrate(share.coin, stats.validShares);
  }

  private calculateMinerHashrate(coin: string, shares: number): number {
    // حساب الـ hashrate من عدد الشيرات
    // hashrate ≈ (shares * difficulty) / time

    const difficulty = this.stats.get(coin)?.difficulty || 1;
    const timeWindow = 60; // 60 seconds

    // تقدير الـ hashrate
    return (shares * difficulty) / timeWindow;
  }

  // =====================================================
  // Block Found Handler
  // =====================================================

  private handleBlockFound(coin: string, data: any): void {
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log(`🎉🎉🎉 NEW ${coin} BLOCK FOUND!`);
    console.log(`   Hash: ${data.hash || 'calculating...'}`);
    console.log('══════════════════════════════════════════════════════════════');
    console.log('');

    // تحديث إحصائيات الكتل
    const poolStats = this.stats.get(coin);
    if (poolStats) {
      poolStats.blocks24h++;
    }

    // إضافة المكافأة لرصيد الحوض
    const reward = this.getBlockReward(coin);
    const poolReward = reward * (1 - this.config.poolFee / 100);

    // توزيع المكافأة على المعدنين (PPLNS)
    this.distributeReward(coin, poolReward);

    // حفظ الحدث في Redis
    this.redis.lPush(`pool:${coin}:blocks`, JSON.stringify({
      hash: data.hash,
      height: poolStats?.blockHeight || 0,
      reward: poolReward,
      timestamp: Date.now()
    }));

    this.emit('blockFound', { coin, hash: data.hash, reward: poolReward });
  }

  private getBlockReward(coin: string): number {
    const rewards: Record<string, number> = {
      'KAS': 10,
      'RVN': 2500,
      'ALPH': 3
    };
    return rewards[coin] || 0;
  }

  private distributeReward(coin: string, reward: number): void {
    // PPLNS - Pay Per Last N Shares
    const nShares = 10000; // آخر 10000 شير
    const recentShares = this.shareBuffer
      .filter(s => s.coin === coin)
      .slice(-nShares);

    if (recentShares.length === 0) return;

    // حساب إجمالي الصعوبة
    const totalDiff = recentShares.reduce((sum, s) => sum + s.difficulty, 0);

    // توزيع المكافأة
    for (const share of recentShares) {
      const key = `${coin}:${share.miner}:${share.worker}`;
      const stats = this.minerStats.get(key);
      if (stats) {
        const shareReward = (share.difficulty / totalDiff) * reward;
        stats.balance += shareReward;
      }
    }

    console.log(`💰 Distributed ${reward} ${coin} to ${recentShares.length} shares`);
  }

  // =====================================================
  // Stats Loop - تحديث حقيقي
  // =====================================================

  private startStatsLoop(): void {
    this.statsInterval = setInterval(async () => {
      await this.updateStats();
    }, 10000); // كل 10 ثواني
  }

  private async updateStats(): Promise<void> {
    for (const [coin, server] of this.stratumServers) {
      const serverStats = server.getStats();
      const poolStats = this.stats.get(coin);

      if (poolStats && serverStats) {
        poolStats.miners = serverStats.miners;
        poolStats.hashrate = this.calculatePoolHashrate(coin);
      }

      // حفظ في Redis
      await this.redis.set(`pool:${coin}:stats`, JSON.stringify(poolStats));
    }
  }

  private calculatePoolHashrate(coin: string): number {
    // حساب الـ hashrate من شيرات آخر 60 ثانية
    const now = Date.now();
    const recentShares = this.shareBuffer.filter(
      s => s.coin === coin && (now - s.timestamp) < 60000
    );

    if (recentShares.length === 0) return 0;

    const totalDiff = recentShares.reduce((sum, s) => sum + s.difficulty, 0);
    return totalDiff; // Simplified
  }

  private startShareProcessor(): void {
    // معالجة الشيرات كل ثانية
    setInterval(() => {
      if (this.shareBuffer.length > 10000) {
        // الاحتفاظ بآخر 10000 شير فقط
        this.shareBuffer = this.shareBuffer.slice(-10000);
      }
    }, 1000);
  }

  // =====================================================
  // Public API - إحصائيات حقيقية
  // =====================================================

  getPoolStats(coin?: string): PoolStats | Map<string, PoolStats> {
    if (coin) {
      return this.stats.get(coin) || null;
    }
    return this.stats;
  }

  getMinerStats(address: string): MinerStats[] {
    const result: MinerStats[] = [];
    for (const [key, stats] of this.minerStats) {
      if (stats.address === address) {
        result.push(stats);
      }
    }
    return result;
  }

  getAllMinerStats(): MinerStats[] {
    return Array.from(this.minerStats.values());
  }

  getConnectedMiners(coin?: string): number {
    let total = 0;
    for (const [c, server] of this.stratumServers) {
      if (!coin || c === coin) {
        total += server.getStats().miners;
      }
    }
    return total;
  }

  getTotalHashrate(coin?: string): number {
    let total = 0;
    for (const [c, stats] of this.stats) {
      if (!coin || c === coin) {
        total += stats.hashrate;
      }
    }
    return total;
  }

  getTotalBlocks24h(): number {
    let total = 0;
    for (const stats of this.stats.values()) {
      total += stats.blocks24h;
    }
    return total;
  }

  isEngineRunning(): boolean {
    return this.isRunning;
  }

  // =====================================================
  // Stop
  // =====================================================

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // إيقاف خوادم Stratum
    for (const [coin, server] of this.stratumServers) {
      await server.stop();
    }

    // إغلاق Redis
    await this.redis.quit();

    console.log('🛑 Mining Engine stopped');
  }
}

export default MiningEngine;
