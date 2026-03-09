/**
 * =====================================================
 * ⛏️ Ravencoin Stratum Server - Standalone
 * =====================================================
 * 
 * خادم Stratum منفصل لـ Ravencoin
 * يعمل على المنفذ 3334
 * 
 * @author Senior Blockchain Architect
 */

const net = require('net');

const PORT = process.env.STRATUM_PORT || 3334;
const COIN = 'RVN';
const ALGORITHM = 'KawPoW';
const DEFAULT_DIFF = 0.5;

console.log('');
console.log('══════════════════════════════════════════════════════════════');
console.log(`🦅 Ravencoin Stratum Server - Port ${PORT}`);
console.log('══════════════════════════════════════════════════════════════');
console.log('');

const miners = new Map();
let jobId = 0;

const server = net.createServer((socket) => {
  const minerId = `${socket.remoteAddress}:${socket.remotePort}`;
  
  const miner = {
    id: minerId,
    socket,
    address: '',
    worker: '',
    difficulty: DEFAULT_DIFF,
    authorized: false,
    shares: 0,
    lastShare: 0
  };
  
  miners.set(minerId, miner);
  console.log(`📥 Miner connected: ${minerId} | Total: ${miners.size}`);

  socket.setEncoding('utf8');
  socket.setTimeout(600000);
  
  let buffer = '';
  
  socket.on('data', (data) => {
    buffer += data;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) handleMessage(miner, line.trim());
    }
  });
  
  socket.on('close', () => {
    miners.delete(minerId);
    console.log(`📤 Miner disconnected: ${minerId} | Total: ${miners.size}`);
  });
  
  socket.on('error', () => miners.delete(minerId));
});

function handleMessage(miner, data) {
  let req;
  try { req = JSON.parse(data); } catch { return; }
  
  const { method, id, params = [] } = req;
  
  switch (method) {
    case 'mining.subscribe':
      send(miner, { id, result: [[['mining.set_difficulty', '1'], ['mining.notify', '1']], '00000000', 4], error: null });
      send(miner, { id: null, method: 'mining.set_difficulty', params: [miner.difficulty] });
      sendJob(miner);
      break;
      
    case 'mining.authorize':
      const [workerName] = params;
      const parts = workerName.split('.');
      miner.address = parts[0];
      miner.worker = parts[1] || 'worker1';
      miner.authorized = true;
      send(miner, { id, result: true, error: null });
      console.log(`✅ Authorized: ${miner.address}.${miner.worker}`);
      break;
      
    case 'mining.submit':
      if (!miner.authorized) {
        send(miner, { id, result: null, error: { code: -1, message: 'Unauthorized' } });
        return;
      }
      miner.shares++;
      miner.lastShare = Date.now();
      send(miner, { id, result: true, error: null });
      
      if (miner.shares % 100 === 0) {
        console.log(`📊 ${miner.address}.${miner.worker}: ${miner.shares} shares`);
      }
      break;
      
    case 'mining.suggest_difficulty':
      const diff = parseFloat(params[0]);
      if (!isNaN(diff)) miner.difficulty = Math.max(0.01, Math.min(1000, diff));
      send(miner, { id, result: true, error: null });
      send(miner, { id: null, method: 'mining.set_difficulty', params: [miner.difficulty] });
      break;
      
    default:
      send(miner, { id, result: true, error: null });
  }
}

function send(miner, data) {
  try { miner.socket.write(JSON.stringify(data) + '\n'); } catch {}
}

function sendJob(miner) {
  jobId++;
  const job = {
    id: null,
    method: 'mining.notify',
    params: [
      `${jobId}`,
      '0'.repeat(64),
      '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff',
      [],
      '20000000',
      '1a44b9f4',
      Math.floor(Date.now() / 1000),
      true
    ]
  };
  send(miner, job);
}

setInterval(() => {
  jobId++;
  const job = {
    id: null,
    method: 'mining.notify',
    params: [
      `${jobId}`,
      '0'.repeat(64),
      '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff',
      [],
      '20000000',
      '1a44b9f4',
      Math.floor(Date.now() / 1000),
      true
    ]
  };
  
  for (const miner of miners.values()) {
    if (miner.authorized) send(miner, job);
  }
}, 60000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Ravencoin Stratum listening on port ${PORT}`);
  console.log(`🔌 Connect: stratum+tcp://YOUR_IP:${PORT}`);
  console.log('');
});
