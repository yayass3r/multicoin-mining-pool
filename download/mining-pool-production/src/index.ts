/**
 * =====================================================
 * Mining Pool - Entry Point
 * =====================================================
 * 
 * نقطة الدخول الرئيسية لحوض التعدين الإنتاجي
 * 
 * @author Senior Blockchain Architect
 */

import { KaspaRPCClient } from './rpc/kaspa-rpc';
import { RavencoinRPCClient } from './rpc/ravencoin-rpc';
import { AlephiumRPCClient } from './rpc/alephium-rpc';
import { StratumServer } from './stratum/stratum-server';
import { RedisStatsManager } from './redis/stats-manager';
import { KHeavyHash, KawPoW, Blake3 } from './native-addons';
import POOL_CONFIG from '../config/pool.config';

// =====================================================
// Global Instances
// =====================================================

let redisManager: RedisStatsManager;
let kaspaClient: KaspaRPCClient;
let ravenClient: RavencoinRPCClient;
let alephiumClient: AlephiumRPCClient;
let stratumServers: Map<string, StratumServer> = new Map();

// =====================================================
// Main Function
// =====================================================

async function main() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('⛏️  MultiCoin Mining Pool - Production');
  console.log('═'.repeat(60));
  console.log('');

  try {
    // 1️⃣ تهيئة Redis
    console.log('📡 Step 1: Initializing Redis...');
    redisManager = new RedisStatsManager(
      `redis://${POOL_CONFIG.redis.host}:${POOL_CONFIG.redis.port}`
    );
    console.log('✅ Redis initialized');

    // 2️⃣ تهيئة Native Validators
    console.log('');
    console.log('📡 Step 2: Loading Native Hash Modules...');
    const kHeavyHash = KHeavyHash.getInstance();
    const kawpow = KawPoW.getInstance();
    const blake3 = Blake3.getInstance();
    console.log('✅ Native modules loaded');

    // 3️⃣ الاتصال بالعقد
    console.log('');
    console.log('📡 Step 3: Connecting to Full Nodes...');

    // Kaspa
    if (POOL_CONFIG.coins.KAS.enabled) {
      kaspaClient = new KaspaRPCClient({
        host: POOL_CONFIG.coins.KAS.rpc.host,
        port: POOL_CONFIG.coins.KAS.rpc.port,
        user: POOL_CONFIG.coins.KAS.rpc.user,
        password: POOL_CONFIG.coins.KAS.rpc.password
      });
      
      const kaspaConnected = await kaspaClient.connect();
      if (kaspaConnected) {
        console.log('✅ Kaspa node connected');
      }
    }

    // Ravencoin
    if (POOL_CONFIG.coins.RVN.enabled) {
      ravenClient = new RavencoinRPCClient({
        host: POOL_CONFIG.coins.RVN.rpc.host,
        port: POOL_CONFIG.coins.RVN.rpc.port,
        user: POOL_CONFIG.coins.RVN.rpc.user,
        password: POOL_CONFIG.coins.RVN.rpc.password
      });
      
      const ravenConnected = await ravenClient.connect();
      if (ravenConnected) {
        console.log('✅ Ravencoin node connected');
      }
    }

    // Alephium
    if (POOL_CONFIG.coins.ALPH.enabled) {
      alephiumClient = new AlephiumRPCClient({
        host: POOL_CONFIG.coins.ALPH.rpc.host,
        port: POOL_CONFIG.coins.ALPH.rpc.port
      });
      
      const alphConnected = await alephiumClient.connect();
      if (alphConnected) {
        console.log('✅ Alephium node connected');
      }
    }

    // 4️⃣ بدء خوادم Stratum
    console.log('');
    console.log('📡 Step 4: Starting Stratum Servers...');

    // Kaspa Stratum
    if (POOL_CONFIG.coins.KAS.enabled && kaspaClient) {
      const kasStratum = new StratumServer({
        port: POOL_CONFIG.coins.KAS.stratumPort,
        coin: 'KAS',
        difficulty: POOL_CONFIG.coins.KAS.mining.defaultDiff,
        minDiff: POOL_CONFIG.coins.KAS.mining.minDiff,
        maxDiff: POOL_CONFIG.coins.KAS.mining.maxDiff,
        vardiff: POOL_CONFIG.coins.KAS.mining.vardiff
      }, redisManager);
      
      kasStratum.setAlgorithmValidator(kHeavyHash);
      await kasStratum.start();
      stratumServers.set('KAS', kasStratum);

      // ربط جلب الكتل مع Stratum
      kaspaClient.on('newBlock', (template) => {
        kasStratum.newJob(template, template.difficulty);
      });

      // بدء جلب الكتل
      kaspaClient.startBlockPolling(POOL_CONFIG.coins.KAS.address);
    }

    // Ravencoin Stratum
    if (POOL_CONFIG.coins.RVN.enabled && ravenClient) {
      const rvnStratum = new StratumServer({
        port: POOL_CONFIG.coins.RVN.stratumPort,
        coin: 'RVN',
        difficulty: POOL_CONFIG.coins.RVN.mining.defaultDiff,
        minDiff: POOL_CONFIG.coins.RVN.mining.minDiff,
        maxDiff: POOL_CONFIG.coins.RVN.mining.maxDiff,
        vardiff: POOL_CONFIG.coins.RVN.mining.vardiff
      }, redisManager);
      
      rvnStratum.setAlgorithmValidator(kawpow);
      await rvnStratum.start();
      stratumServers.set('RVN', rvnStratum);

      ravenClient.on('newBlock', (template) => {
        rvnStratum.newJob(template, template.difficulty);
      });

      ravenClient.startBlockPolling(POOL_CONFIG.coins.RVN.address);
    }

    // Alephium Stratum
    if (POOL_CONFIG.coins.ALPH.enabled && alephiumClient) {
      const alphStratum = new StratumServer({
        port: POOL_CONFIG.coins.ALPH.stratumPort,
        coin: 'ALPH',
        difficulty: POOL_CONFIG.coins.ALPH.mining.defaultDiff,
        minDiff: POOL_CONFIG.coins.ALPH.mining.minDiff,
        maxDiff: POOL_CONFIG.coins.ALPH.mining.maxDiff,
        vardiff: POOL_CONFIG.coins.ALPH.mining.vardiff
      }, redisManager);
      
      alphStratum.setAlgorithmValidator(blake3);
      await alphStratum.start();
      stratumServers.set('ALPH', alphStratum);

      alephiumClient.on('newBlock', (template) => {
        alphStratum.newJob(template, template.difficulty);
      });

      alephiumClient.startBlockPolling(POOL_CONFIG.coins.ALPH.address);
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log('✅ Mining Pool is Running!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('📡 Stratum Ports:');
    console.log(`   KAS:  ${POOL_CONFIG.coins.KAS.stratumPort}`);
    console.log(`   RVN:  ${POOL_CONFIG.coins.RVN.stratumPort}`);
    console.log(`   ALPH: ${POOL_CONFIG.coins.ALPH.stratumPort}`);
    console.log('');
    console.log('🌐 API: http://localhost:' + POOL_CONFIG.api.port);
    console.log('');
    console.log('═'.repeat(60));
    console.log('⛏️  Ready for mining! Waiting for connections...');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// =====================================================
// Signal Handlers
// =====================================================

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  
  for (const [coin, server] of stratumServers) {
    await server.stop();
  }
  
  if (kaspaClient) kaspaClient.disconnect();
  if (ravenClient) ravenClient.disconnect();
  if (alephiumClient) alephiumClient.disconnect();
  if (redisManager) await redisManager.disconnect();
  
  console.log('👋 Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM...');
  
  for (const [coin, server] of stratumServers) {
    await server.stop();
  }
  
  process.exit(0);
});

// =====================================================
// Start
// =====================================================

main();
