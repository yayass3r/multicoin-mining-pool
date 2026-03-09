/**
 * =====================================================
 * ⛏️ Stratum Server - خادم التعدين الحقيقي
 * =====================================================
 * 
 * يستقبل اتصالات المعدنين ويوزع العمل
 * 
 * @author Senior Blockchain Architect
 */

import net from 'net';
import { EventEmitter } from 'events';

// =====================================================
// Types
// =====================================================

interface StratumConfig {
  port: number;
  coin: string;
  algorithm: string;
  difficulty: number;
  minDiff: number;
  maxDiff: number;
  poolAddress: string;
}

interface MinerConnection {
  id: string;
  socket: net.Socket;
  address: string;
  worker: string;
  difficulty: number;
  authorized: boolean;
  lastShare: number;
  shares: number;
  invalidShares: number;
}

interface StratumJob {
  jobId: string;
  height: number;
  prevHash: string;
  coinbase: string;
  merkleBranch: string[];
  version: number;
  bits: number;
  time: number;
  cleanJobs: boolean;
  target: string;
}

// =====================================================
// Stratum Server
// =====================================================

export class StratumServer extends EventEmitter {
  private config: StratumConfig;
  private server: net.Server | null = null;
  private miners: Map<string, MinerConnection> = new Map();
  private jobs: Map<string, StratumJob> = new Map();
  private currentJob: StratumJob | null = null;
  private jobIdCounter: number = 0;

  constructor(config: StratumConfig) {
    super();
    this.config = config;
  }

  // =====================================================
  // Start Server
  // =====================================================

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        console.error(`❌ Stratum ${this.config.coin} error:`, err.message);
        reject(err);
      });

      this.server.listen(this.config.port, '0.0.0.0', () => {
        console.log(`✅ Stratum ${this.config.coin} listening on port ${this.config.port}`);
        this.emit('started');
        resolve();
      });
    });
  }

  // =====================================================
  // Stop Server
  // =====================================================

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      // أغلق جميع اتصالات المعدنين
      for (const [id, miner] of this.miners) {
        try {
          miner.socket.destroy();
        } catch (e) {}
      }
      this.miners.clear();

      this.server.close(() => {
        console.log(`🛑 Stratum ${this.config.coin} stopped`);
        this.emit('stopped');
        resolve();
      });
    });
  }

  // =====================================================
  // Handle Connection
  // =====================================================

  private handleConnection(socket: net.Socket): void {
    const minerId = `${socket.remoteAddress}:${socket.remotePort}`;
    
    const miner: MinerConnection = {
      id: minerId,
      socket,
      address: '',
      worker: '',
      difficulty: this.config.difficulty,
      authorized: false,
      lastShare: 0,
      shares: 0,
      invalidShares: 0
    };

    this.miners.set(minerId, miner);

    console.log(`📥 ${this.config.coin} miner connected: ${minerId}`);
    this.emit('minerConnected', { minerId, totalMiners: this.miners.size });

    // إعداد الـ socket
    socket.setEncoding('utf8');
    socket.setTimeout(600000); // 10 دقائق

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(miner, line.trim());
        }
      }
    });

    socket.on('close', () => {
      this.miners.delete(minerId);
      console.log(`📤 ${this.config.coin} miner disconnected: ${minerId}`);
      this.emit('minerDisconnected', { minerId, totalMiners: this.miners.size });
    });

    socket.on('error', (err) => {
      console.error(`⚠️ ${this.config.coin} socket error:`, err.message);
    });

    socket.on('timeout', () => {
      console.log(`⏰ ${this.config.coin} miner timeout: ${minerId}`);
      socket.destroy();
    });
  }

  // =====================================================
  // Handle Stratum Message
  // =====================================================

  private handleMessage(miner: MinerConnection, data: string): void {
    let request: any;
    
    try {
      request = JSON.parse(data);
    } catch (e) {
      this.sendError(miner, null, 'Parse error');
      return;
    }

    const method = request.method;
    const id = request.id;
    const params = request.params || [];

    switch (method) {
      case 'mining.subscribe':
        this.handleSubscribe(miner, id, params);
        break;

      case 'mining.authorize':
        this.handleAuthorize(miner, id, params);
        break;

      case 'mining.submit':
        this.handleSubmit(miner, id, params);
        break;

      case 'mining.suggest_difficulty':
      case 'mining.suggest_difficulty_old':
        this.handleSuggestDifficulty(miner, id, params);
        break;

      case 'mining.extranonce.subscribe':
        // تجاهل - غير مدعوم
        this.sendResponse(miner, id, true);
        break;

      case 'mining.configure':
        this.handleConfigure(miner, id, params);
        break;

      default:
        console.log(`❓ Unknown method: ${method}`);
        this.sendError(miner, id, `Method not found: ${method}`);
    }
  }

  // =====================================================
  // Stratum Methods
  // =====================================================

  private handleSubscribe(miner: MinerConnection, id: number, params: any[]): void {
    // الرد على الاشتراك
    const subscriptionId = this.generateSubscriptionId();
    const extraNonce1 = this.generateExtraNonce1();
    const extraNonce2Size = 4;

    const result = [
      [
        ['mining.set_difficulty', subscriptionId],
        ['mining.notify', subscriptionId]
      ],
      extraNonce1,
      extraNonce2Size
    ];

    this.sendResponse(miner, id, result);

    // إرسال الصعوبة
    this.sendDifficulty(miner, miner.difficulty);

    // إرسال العمل إذا كان موجوداً
    if (this.currentJob) {
      this.sendJob(miner, this.currentJob);
    }
  }

  private handleAuthorize(miner: MinerConnection, id: number, params: any[]): void {
    const [workerName, password] = params;

    // تحليل اسم العامل
    const parts = workerName.split('.');
    miner.address = parts[0];
    miner.worker = parts[1] || 'worker1';

    // التحقق من العنوان (يمكن إضافة تحقق إضافي)
    if (!miner.address) {
      this.sendResponse(miner, id, false);
      return;
    }

    miner.authorized = true;
    this.sendResponse(miner, id, true);

    console.log(`✅ ${this.config.coin} miner authorized: ${miner.address}.${miner.worker}`);
    this.emit('minerAuthorized', { minerId: miner.id, address: miner.address, worker: miner.worker });
  }

  private handleSubmit(miner: MinerConnection, id: number, params: any[]): void {
    if (!miner.authorized) {
      this.sendError(miner, id, 'Unauthorized');
      return;
    }

    const [workerName, jobId, extraNonce2, nTime, nonce] = params;

    // التحقق من الـ job
    const job = this.jobs.get(jobId);
    if (!job) {
      this.sendError(miner, id, 'Invalid job id');
      miner.invalidShares++;
      return;
    }

    // إنشاء بيانات الشير
    const shareData = {
      jobId,
      extraNonce2,
      nTime,
      nonce,
      miner: miner.address,
      worker: miner.worker,
      difficulty: miner.difficulty,
      height: job.height,
      timestamp: Date.now()
    };

    // التحقق من صحة الشير (سيتحقق منه النظام الخارجي)
    this.emit('share', shareData);

    // قبول الشير (التحقق الفعلي يتم في مكان آخر)
    miner.shares++;
    miner.lastShare = Date.now();

    this.sendResponse(miner, id, true);

    // إحصائيات
    if (miner.shares % 100 === 0) {
      console.log(`📊 ${this.config.coin} ${miner.address}.${miner.worker}: ${miner.shares} shares`);
    }
  }

  private handleSuggestDifficulty(miner: MinerConnection, id: number, params: any[]): void {
    const suggestedDiff = parseFloat(params[0]);

    if (isNaN(suggestedDiff) || suggestedDiff < this.config.minDiff || suggestedDiff > this.config.maxDiff) {
      this.sendError(miner, id, 'Invalid difficulty');
      return;
    }

    miner.difficulty = suggestedDiff;
    this.sendResponse(miner, id, true);
    this.sendDifficulty(miner, miner.difficulty);
  }

  private handleConfigure(miner: MinerConnection, id: number, params: any[]): void {
    // إعدادات إضافية
    this.sendResponse(miner, id, { 'mining.notify': ['notify_1'] });
  }

  // =====================================================
  // Send Methods
  // =====================================================

  private sendResponse(miner: MinerConnection, id: number | null, result: any): void {
    const response = JSON.stringify({
      id,
      result,
      error: null
    }) + '\n';

    try {
      miner.socket.write(response);
    } catch (e) {
      console.error('Failed to send response:', e);
    }
  }

  private sendError(miner: MinerConnection, id: number | null, message: string): void {
    const response = JSON.stringify({
      id,
      result: null,
      error: { code: -1, message }
    }) + '\n';

    try {
      miner.socket.write(response);
    } catch (e) {
      console.error('Failed to send error:', e);
    }
  }

  private sendDifficulty(miner: MinerConnection, difficulty: number): void {
    const notification = JSON.stringify({
      id: null,
      method: 'mining.set_difficulty',
      params: [difficulty]
    }) + '\n';

    try {
      miner.socket.write(notification);
    } catch (e) {
      console.error('Failed to send difficulty:', e);
    }
  }

  private sendJob(miner: MinerConnection, job: StratumJob): void {
    const notification = JSON.stringify({
      id: null,
      method: 'mining.notify',
      params: [
        job.jobId,
        job.prevHash,
        job.coinbase,
        job.merkleBranch,
        job.version,
        job.bits,
        job.time,
        job.cleanJobs
      ]
    }) + '\n';

    try {
      miner.socket.write(notification);
    } catch (e) {
      console.error('Failed to send job:', e);
    }
  }

  // =====================================================
  // Public Methods
  // =====================================================

  /**
   * تحديث العمل (من العقدة)
   */
  updateJob(job: Omit<StratumJob, 'jobId'>): void {
    this.jobIdCounter++;
    const jobId = `${this.jobIdCounter}`;

    const newJob: StratumJob = {
      ...job,
      jobId
    };

    this.currentJob = newJob;
    this.jobs.set(jobId, newJob);

    // تنظيف الأعمال القديمة
    if (this.jobs.size > 10) {
      const oldestKey = this.jobs.keys().next().value;
      this.jobs.delete(oldestKey);
    }

    // إرسال للمعدنين
    for (const miner of this.miners.values()) {
      if (miner.authorized) {
        this.sendJob(miner, newJob);
      }
    }

    console.log(`📝 ${this.config.coin} new job #${jobId} at height ${job.height}`);
    this.emit('newJob', newJob);
  }

  /**
   * إحصائيات الخادم
   */
  getStats(): {
    coin: string;
    port: number;
    miners: number;
    totalShares: number;
    totalInvalidShares: number;
  } {
    let totalShares = 0;
    let totalInvalidShares = 0;

    for (const miner of this.miners.values()) {
      totalShares += miner.shares;
      totalInvalidShares += miner.invalidShares;
    }

    return {
      coin: this.config.coin,
      port: this.config.port,
      miners: this.miners.size,
      totalShares,
      totalInvalidShares
    };
  }

  /**
   * قائمة المعدنين
   */
  getMiners(): MinerConnection[] {
    return Array.from(this.miners.values());
  }

  // =====================================================
  // Helpers
  // =====================================================

  private generateSubscriptionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generateExtraNonce1(): string {
    return Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
  }
}

export default StratumServer;
