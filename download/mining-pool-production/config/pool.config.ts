/**
 * =====================================================
 * Pool Configuration - إعدادات الحوض
 * =====================================================
 */

export const POOL_CONFIG = {
  // معلومات الحوض
  name: 'MultiCoin Mining Pool',
  version: '1.0.0',
  donationAddress: 'donation@yourpool.com',
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    db: 0
  },

  // إعدادات العملات
  coins: {
    KAS: {
      enabled: true,
      algorithm: 'kHeavyHash',
      stratumPort: 3333,
      rpc: {
        host: process.env.KASPA_RPC_HOST || 'localhost',
        port: parseInt(process.env.KASPA_RPC_PORT || '16110'),
        user: process.env.KASPA_RPC_USER || 'kaspa_rpc',
        password: process.env.KASPA_RPC_PASS || 'kaspa_password'
      },
      mining: {
        minDiff: 8192,
        maxDiff: 1048576,
        defaultDiff: 16384,
        vardiff: true,
        retargetTime: 60,
        targetShareTime: 10
      },
      payout: {
        minPayout: 1.0,
        fee: 0.01 // 1%
      },
      address: process.env.KASPA_MINING_ADDRESS || ''
    },

    RVN: {
      enabled: true,
      algorithm: 'KawPoW',
      stratumPort: 3334,
      rpc: {
        host: process.env.RAVEN_RPC_HOST || 'localhost',
        port: parseInt(process.env.RAVEN_RPC_PORT || '8766'),
        user: process.env.RAVEN_RPC_USER || 'raven_rpc',
        password: process.env.RAVEN_RPC_PASS || 'raven_password'
      },
      mining: {
        minDiff: 0.1,
        maxDiff: 1000,
        defaultDiff: 0.5,
        vardiff: true,
        retargetTime: 60,
        targetShareTime: 10
      },
      payout: {
        minPayout: 10,
        fee: 0.01
      },
      address: process.env.RAVEN_MINING_ADDRESS || ''
    },

    ALPH: {
      enabled: true,
      algorithm: 'Blake3',
      stratumPort: 3336,
      rpc: {
        host: process.env.ALEPHIUM_API_HOST || 'localhost',
        port: parseInt(process.env.ALEPHIUM_API_PORT || '12973'),
        apiKey: process.env.ALEPHIUM_API_KEY || ''
      },
      mining: {
        minDiff: 100,
        maxDiff: 100000,
        defaultDiff: 1000,
        vardiff: true,
        retargetTime: 60,
        targetShareTime: 10
      },
      payout: {
        minPayout: 0.5,
        fee: 0.01
      },
      address: process.env.ALEPHIUM_MINING_ADDRESS || ''
    }
  },

  // API
  api: {
    port: parseInt(process.env.API_PORT || '8080'),
    enabled: true
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: '/var/log/mining-pool/pool.log'
  }
};

export default POOL_CONFIG;
