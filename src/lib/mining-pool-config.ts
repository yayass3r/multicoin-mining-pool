// =====================================================
// إعدادات حوض التعدين متعدد العملات
// Multi-Coin Mining Pool Configuration
// =====================================================

export interface CoinConfig {
  ticker: string;
  name: string;
  algorithm: string;
  stratumPort: number;
  difficulty: number;
  minPayout: number;
  poolFee: number;
  walletAddress: string;
  nodeUrl: string;
  enabled: boolean;
  color: string;
  icon: string;
}

export const COIN_CONFIGS: Record<string, CoinConfig> = {
  KAS: {
    ticker: "KAS",
    name: "Kaspa",
    algorithm: "kHeavyHash",
    stratumPort: 3333,
    difficulty: 16384,
    minPayout: 100,
    poolFee: 1.0,
    walletAddress: "kaspa:qp0nl57r2t2mntlan756383khkukmjf8z7nstl066aqdr0xcjj8n54vstafuj",
    nodeUrl: "127.0.0.1:16110",
    enabled: true,
    color: "#00D4AA",
    icon: "kaspa.svg"
  },
  RVN: {
    ticker: "RVN",
    name: "Ravencoin",
    algorithm: "KawPoW",
    stratumPort: 3334,
    difficulty: 0.5,
    minPayout: 10,
    poolFee: 1.0,
    walletAddress: "REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y",
    nodeUrl: "127.0.0.1:8766",
    enabled: true,
    color: "#B456BE",
    icon: "ravencoin.svg"
  },
  ZEPH: {
    ticker: "ZEPH",
    name: "Zephyr Protocol",
    algorithm: "RandomX",
    stratumPort: 3335,
    difficulty: 50000,
    minPayout: 0.1,
    poolFee: 1.0,
    walletAddress: "TO_BE_ADDED",
    nodeUrl: "127.0.0.1:18081",
    enabled: false,  // ⛔ تم إيقاف التعدين
    color: "#1E88E5",
    icon: "zephyr.svg"
  },
  ALPH: {
    ticker: "ALPH",
    name: "Alephium",
    algorithm: "Blake3",
    stratumPort: 3336,
    difficulty: 1000,
    minPayout: 1,
    poolFee: 1.0,
    walletAddress: "1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b",
    nodeUrl: "127.0.0.1:12973",
    enabled: true,
    color: "#FF6B35",
    icon: "alephium.svg"
  }
};

// إعدادات عامة للحوض
export const POOL_CONFIG = {
  poolName: "MultiCoin Mining Pool",
  poolVersion: "1.0.0",
  website: "https://your-pool-domain.com",
  apiPort: 8080,
  adminPort: 8081,
  redisHost: "127.0.0.1",
  redisPort: 6379,
  databaseUrl: "postgresql://user:password@localhost:5432/mining_pool",
  blockRefreshInterval: 500,
  statsUpdateInterval: 10000,
  paymentInterval: 3600000, // كل ساعة
  minConfirmations: {
    KAS: 10,
    RVN: 60,
    ZEPH: 10,
    ALPH: 5
  }
};

// رسائل النظام
export const SYSTEM_MESSAGES = {
  ar: {
    welcome: "مرحباً بك في حوض التعدين متعدد العملات",
    stratumConnected: "متصل بخادم Stratum",
    miningStarted: "بدء التعدين",
    shareAccepted: "تم قبول الشير",
    shareRejected: "تم رفض الشير",
    blockFound: "تم اكتشاف كتلة جديدة!",
    paymentSent: "تم إرسال الدفعة"
  },
  en: {
    welcome: "Welcome to MultiCoin Mining Pool",
    stratumConnected: "Connected to Stratum server",
    miningStarted: "Mining started",
    shareAccepted: "Share accepted",
    shareRejected: "Share rejected",
    blockFound: "New block found!",
    paymentSent: "Payment sent"
  }
};
