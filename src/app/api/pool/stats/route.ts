import { NextResponse } from 'next/server';
import { COIN_CONFIGS, POOL_CONFIG } from '@/lib/mining-pool-config';

// محاكاة بيانات الإحصائيات الحية
// في الإنتاج، هذه البيانات تأتي من Redis وقاعدة البيانات
function generateLiveStats(coin: string) {
  const config = COIN_CONFIGS[coin];
  if (!config) return null;

  // بيانات محاكاة - في الواقع تأتي من Redis
  const hashrate = Math.floor(Math.random() * 1000000) + 500000;
  const miners = Math.floor(Math.random() * 500) + 100;
  const workers = Math.floor(Math.random() * 1500) + 300;
  const blocks24h = Math.floor(Math.random() * 50) + 10;
  const lastBlock = Date.now() - Math.floor(Math.random() * 3600000);
  
  return {
    coin: coin,
    name: config.name,
    algorithm: config.algorithm,
    enabled: config.enabled,
    
    // إحصائيات الحوض
    poolHashrate: hashrate,
    poolHashrateFormatted: formatHashrate(hashrate),
    activeMiners: miners,
    activeWorkers: workers,
    
    // الكتل
    blocksFound24h: blocks24h,
    lastBlockTime: lastBlock,
    lastBlockHeight: Math.floor(Math.random() * 1000000) + 1000000,
    currentHeight: Math.floor(Math.random() * 1000000) + 1000000,
    networkDifficulty: Math.floor(Math.random() * 100000000) + 10000000,
    
    // الإعدادات
    stratumPort: config.stratumPort,
    difficulty: config.difficulty,
    minPayout: config.minPayout,
    poolFee: config.poolFee,
    
    // معلومات الشبكة
    networkHashrate: hashrate * (Math.random() * 5 + 2),
    blockReward: getBlockReward(coin),
    
    // العنوان
    walletAddress: config.walletAddress,
    color: config.color
  };
}

function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e12) return (hashrate / 1e12).toFixed(2) + ' TH/s';
  if (hashrate >= 1e9) return (hashrate / 1e9).toFixed(2) + ' GH/s';
  if (hashrate >= 1e6) return (hashrate / 1e6).toFixed(2) + ' MH/s';
  if (hashrate >= 1e3) return (hashrate / 1e3).toFixed(2) + ' KH/s';
  return hashrate.toFixed(2) + ' H/s';
}

function getBlockReward(coin: string): number {
  const rewards: Record<string, number> = {
    KAS: 10,
    RVN: 2500,
    ZEPH: 2.5,
    ALPH: 3
  };
  return rewards[coin] || 0;
}

export async function GET() {
  try {
    const stats: Record<string, unknown> = {
      pool: {
        name: POOL_CONFIG.poolName,
        version: POOL_CONFIG.poolVersion,
        timestamp: Date.now()
      }
    };

    // إحصائيات كل عملة
    for (const coin of Object.keys(COIN_CONFIGS)) {
      stats[coin.toLowerCase()] = generateLiveStats(coin);
    }

    // إحصائيات عامة
    stats['total'] = {
      totalMiners: Object.keys(COIN_CONFIGS).reduce((sum, coin) => {
        const s = generateLiveStats(coin);
        return sum + (s?.activeMiners || 0);
      }, 0),
      totalWorkers: Object.keys(COIN_CONFIGS).reduce((sum, coin) => {
        const s = generateLiveStats(coin);
        return sum + (s?.activeWorkers || 0);
      }, 0),
      totalBlocks24h: Object.keys(COIN_CONFIGS).reduce((sum, coin) => {
        const s = generateLiveStats(coin);
        return sum + (s?.blocksFound24h || 0);
      }, 0)
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching pool stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pool statistics' },
      { status: 500 }
    );
  }
}
