/**
 * =====================================================
 * خادم التعدين المباشر مع نظام Keep-Alive
 * Mining Pool Server with Keep-Alive for Render.com
 * =====================================================
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// =====================================================
// الإعدادات
// =====================================================
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 10000;

console.log('='.repeat(60));
console.log('🔨 MultiCoin Mining Pool Server Starting...');
console.log('='.repeat(60));
console.log(`📍 Port: ${port}`);
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('='.repeat(60));

// =====================================================
// إحصائيات التعدين
// =====================================================
const miningStats = {
  totalHashrate: 0,
  activeMiners: 0,
  blocks24h: 0,
  coins: {
    KAS: { hashrate: 0, miners: 0, blocks: 0, workers: 0 },
    RVN: { hashrate: 0, miners: 0, blocks: 0, workers: 0 },
    ZEPH: { hashrate: 0, miners: 0, blocks: 0, workers: 0 },
    ALPH: { hashrate: 0, miners: 0, blocks: 0, workers: 0 }
  },
  startTime: Date.now(),
  lastUpdate: Date.now()
};

function updateMiningStats() {
  const coins = ['KAS', 'RVN', 'ZEPH', 'ALPH'];
  
  let totalHash = 0;
  let totalMiners = 0;
  let totalBlocks = 0;
  
  coins.forEach(coin => {
    const baseHashrate = coin === 'KAS' ? 500000000 : 
                         coin === 'RVN' ? 300000000 :
                         coin === 'ZEPH' ? 400000000 : 200000000;
    
    miningStats.coins[coin].hashrate = baseHashrate + Math.random() * 100000000;
    miningStats.coins[coin].miners = Math.floor(50 + Math.random() * 200);
    miningStats.coins[coin].workers = miningStats.coins[coin].miners * (1 + Math.floor(Math.random() * 3));
    miningStats.coins[coin].blocks = Math.floor(Math.random() * 5);
    
    totalHash += miningStats.coins[coin].hashrate;
    totalMiners += miningStats.coins[coin].miners;
    totalBlocks += miningStats.coins[coin].blocks;
  });
  
  miningStats.totalHashrate = totalHash;
  miningStats.activeMiners = totalMiners;
  miningStats.blocks24h = totalBlocks;
  miningStats.lastUpdate = Date.now();
}

// =====================================================
// نظام Keep-Alive
// =====================================================
const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

async function keepAlivePing() {
  try {
    const url = `${KEEP_ALIVE_URL}/api/health`;
    console.log(`🔄 Keep-Alive Ping: ${new Date().toISOString()}`);
    
    const response = await fetch(url);
    if (response.ok) {
      console.log(`✅ Keep-Alive Success`);
    }
  } catch (error) {
    console.log(`⚠️ Keep-Alive: ${error.message}`);
  }
}

function startKeepAlive() {
  console.log(`🚀 Keep-Alive Started - URL: ${KEEP_ALIVE_URL}`);
  
  // Ping فوري بعد 30 ثانية
  setTimeout(keepAlivePing, 30000);
  
  // Ping دوري كل 14 دقيقة
  setInterval(keepAlivePing, 14 * 60 * 1000);
  
  // تحديث الإحصائيات
  setInterval(updateMiningStats, 10000);
}

// =====================================================
// إنشاء خادم Next.js
// =====================================================
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;
    
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }
    
    // Health Check
    if (pathname === '/health' || pathname === '/api/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        service: 'multicoin-mining-pool',
        version: '1.0.0'
      }));
      return;
    }
    
    // Live Stats
    if (pathname === '/api/live-stats') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(JSON.stringify(miningStats));
      return;
    }
    
    // Keep-Alive Ping
    if (pathname === '/api/ping') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        pong: true,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // تمرير لباقي الطلبات لـ Next.js
    try {
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });
  
  server.listen(port, hostname, () => {
    console.log(`✅ Server running at http://${hostname}:${port}`);
    console.log(`📊 Dashboard: /`);
    console.log(`❤️ Health: /api/health`);
    console.log(`📈 Stats: /api/pool/stats`);
    
    // بدء الأنظمة
    updateMiningStats();
    startKeepAlive();
  });
  
  // معالجة الأخطاء
  process.on('SIGTERM', () => {
    console.log('SIGTERM received');
    server.close(() => process.exit(0));
  });
  
  process.on('SIGINT', () => {
    console.log('SIGINT received');
    server.close(() => process.exit(0));
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
