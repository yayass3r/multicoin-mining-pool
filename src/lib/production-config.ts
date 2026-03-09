/**
 * =====================================================
 * إعدادات الإنتاج الحقيقي
 * Production Configuration
 * =====================================================
 * 
 * إعدادات العقد الحقيقية للتعدين
 * 
 * @author Senior Blockchain Architect
 */

// =====================================================
// إعدادات العقد RPC
// =====================================================

export const PRODUCTION_NODES = {
  // Kaspa Node
  KAS: {
    // العقدة المحلية (Docker)
    local: {
      host: process.env.KASPA_RPC_HOST || '127.0.0.1',
      port: parseInt(process.env.KASPA_RPC_PORT || '16110'),
      user: process.env.KASPA_RPC_USER || 'kaspa_rpc',
      password: process.env.KASPA_RPC_PASS || 'kaspa_secure_password',
      ssl: false
    },
    // عقدة عامة (fallback)
    public: {
      host: 'api.kaspa.org',
      port: 443,
      ssl: true
    }
  },
  
  // Ravencoin Node
  RVN: {
    local: {
      host: process.env.RAVEN_RPC_HOST || '127.0.0.1',
      port: parseInt(process.env.RAVEN_RPC_PORT || '8766'),
      user: process.env.RAVEN_RPC_USER || 'raven_rpc',
      password: process.env.RAVEN_RPC_PASS || 'raven_secure_password',
      ssl: false
    }
  },
  
  // Alephium Node
  ALPH: {
    local: {
      host: process.env.ALEPHIUM_API_HOST || '127.0.0.1',
      port: parseInt(process.env.ALEPHIUM_API_PORT || '12973'),
      apiKey: process.env.ALEPHIUM_API_KEY || ''
    }
  }
};

// =====================================================
// إعدادات Redis
// =====================================================

export const REDIS_CONFIG = {
  // Redis Cloud (للإنتاج)
  cloud: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Redis محلي (للتطوير)
  local: 'redis://localhost:6379'
};

// =====================================================
// إعدادات التعدين
// =====================================================

export const MINING_CONFIG = {
  KAS: {
    algorithm: 'kHeavyHash',
    stratumPort: 3333,
    defaultDiff: 16384,
    minDiff: 256,
    maxDiff: 4294967296,
    vardiff: {
      targetSharesPerMin: 20,
      minDiff: 256,
      maxDiff: 4294967296,
      diffStep: 0.05
    },
    blockReward: 10, // KAS
    blockTime: 1, // seconds
    confirmations: 10
  },
  
  RVN: {
    algorithm: 'KawPoW',
    stratumPort: 3334,
    defaultDiff: 0.5,
    minDiff: 0.01,
    maxDiff: 1000,
    vardiff: {
      targetSharesPerMin: 20,
      minDiff: 0.01,
      maxDiff: 1000,
      diffStep: 0.05
    },
    blockReward: 2500, // RVN
    blockTime: 60, // seconds
    confirmations: 60
  },
  
  ALPH: {
    algorithm: 'Blake3',
    stratumPort: 3336,
    defaultDiff: 1000,
    minDiff: 1,
    maxDiff: 100000000,
    vardiff: {
      targetSharesPerMin: 20,
      minDiff: 1,
      maxDiff: 100000000,
      diffStep: 0.05
    },
    blockReward: 3, // ALPH
    blockTime: 64, // seconds
    confirmations: 5
  }
};

// =====================================================
// المحافظ
// =====================================================

export const WALLET_ADDRESSES = {
  KAS: process.env.KAS_WALLET || 'kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86',
  RVN: process.env.RVN_WALLET || 'REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y',
  ALPH: process.env.ALPH_WALLET || '1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b'
};

// =====================================================
// أسعار العملات (للعرض)
// =====================================================

export const COIN_PRICES = {
  KAS: {
    usd: 0.15,
    btc: 0.0000035
  },
  RVN: {
    usd: 0.02,
    btc: 0.00000045
  },
  ALPH: {
    usd: 0.35,
    btc: 0.0000078
  }
};

// =====================================================
// رسوم الحوض
// =====================================================

export const POOL_FEES = {
  poolFee: 1.0, // 1%
  minPayout: {
    KAS: 1.0,
    RVN: 10.0,
    ALPH: 0.5
  },
  paymentInterval: 3600000 // كل ساعة
};

// =====================================================
// إعدادات الخادم
// =====================================================

export const SERVER_CONFIG = {
  port: process.env.PORT || 10000,
  host: process.env.HOST || '0.0.0.0',
  keepAliveInterval: 10 * 60 * 1000, // 10 دقائق
  statsUpdateInterval: 10000, // 10 ثواني
  blockRefreshInterval: 500 // 500ms
};

const ProductionConfig = {
  PRODUCTION_NODES,
  REDIS_CONFIG,
  MINING_CONFIG,
  WALLET_ADDRESSES,
  COIN_PRICES,
  POOL_FEES,
  SERVER_CONFIG
};

export default ProductionConfig;
