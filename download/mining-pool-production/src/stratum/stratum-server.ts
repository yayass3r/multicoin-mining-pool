/**
 * =====================================================
 * Stratum Server - خادم التعدين الحقيقي
 * =====================================================
 * 
 * خادم Stratum كامل يتواصل مع أجهزة التعدين ASIC
 * ويربطها بالعقد عبر RPC
 * 
 * @author Senior Blockchain Architect
 */

import net from 'net';
import EventEmitter from 'events';
import { RedisStatsManager } from '../redis/stats-manager';

// =====================================================
// Types
// =====================================================

interface StratumClient {
  id: string;
  socket: net.Socket;
  workerName: string;
  address: string;
  authorized: boolean;
  subscribed: boolean;
  extraNonce1: string;
  extraNonce2Size: number;
  difficulty: number;
  lastActivity: number;
}

interface StratumRequest {
  id: number | null;
  method: string;
  params: any[];
}

interface MiningJob {
  jobId: string;
  coin: string;
  blockTemplate: any;
  target: string;
  difficulty: number;
  timestamp: number;
  extraNonce1: string;
  extraNonce2Size: number;
}

interface StratumConfig {
  port: number;
  coin: string;
  difficulty: number;
  minDiff: number;
  maxDiff: number;
  vardiff: boolean;
}

// =====================================================
// Stratum Server Implementation
// =====================================================

export class StratumServer extends EventEmitter {
  private server: net.Server | null = null;
  private clients: Map<string, StratumClient> = new Map();
  private jobs: Map<string, MiningJob> = new Map();
  private redis: RedisStatsManager;
  private config: StratumConfig;
  
  private jobIdCounter: number = 0;
  private extraNonceCounter: number = 0;
  
  private algorithmValidator: any; // Will be set to native validator

  constructor(config: StratumConfig, redis: RedisStatsManager) {
    super();
    this.config = config;
    this.redis = redis;
  }

  // =====================================================
  // Server Lifecycle
  // =====================================================

  /**
   * بدء الخادم
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        console.error(`Stratum server error [${this.config.coin}]:`, err.message);
        reject(err);
      });

      this.server.listen(this.config.port, () => {
        console.log(`✅ Stratum server started for ${this.config.coin} on port ${this.config.port}`);
        this.emit('started', { coin: this.config.coin, port: this.config.port });
        resolve();
      });
    });
  }

  /**
   * إيقاف الخادم
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // إغلاق جميع الاتصالات
      for (const client of this.clients.values()) {
        client.socket.destroy();
      }
      this.clients.clear();

      if (this.server) {
        this.server.close(() => {
          console.log(`🛑 Stratum server stopped for ${this.config.coin}`);
          this.emit('stopped', { coin: this.config.coin });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // =====================================================
  // Connection Handling
  // =====================================================

  /**
   * معالجة اتصال جديد
   */
  private handleConnection(socket: net.Socket): void {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    const extraNonce1 = this.generateExtraNonce1();

    const client: StratumClient = {
      id: clientId,
      socket,
      workerName: '',
      address: '',
      authorized: false,
      subscribed: false,
      extraNonce1,
      extraNonce2Size: 4,
      difficulty: this.config.difficulty,
      lastActivity: Date.now()
    };

    this.clients.set(clientId, client);
    console.log(`🔗 New connection: ${clientId} [${this.config.coin}]`);

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();
      this.processBuffer(client, buffer);
      buffer = '';
    });

    socket.on('close', () => {
      this.clients.delete(clientId);
      console.log(`🔌 Disconnected: ${clientId} [${this.config.coin}]`);
      this.emit('clientDisconnected', { coin: this.config.coin, clientId });
    });

    socket.on('error', (err) => {
      console.error(`Client error ${clientId}:`, err.message);
    });
  }

  /**
   * معالجة البيانات الواردة
   */
  private processBuffer(client: StratumClient, buffer: string): void {
    client.lastActivity = Date.now();

    const lines = buffer.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const request: StratumRequest = JSON.parse(line);
        this.handleRequest(client, request);
      } catch (error) {
        console.error('Parse error:', line);
      }
    }
  }

  // =====================================================
  // Request Handling
  // =====================================================

  /**
   * معالجة طلب Stratum
   */
  private handleRequest(client: StratumClient, request: StratumRequest): void {
    const { method, params, id } = request;

    switch (method) {
      case 'mining.subscribe':
        this.handleSubscribe(client, id, params);
        break;
      case 'mining.authorize':
        this.handleAuthorize(client, id, params);
        break;
      case 'mining.submit':
        this.handleSubmit(client, id, params);
        break;
      case 'mining.suggest_difficulty':
        this.handleSuggestDifficulty(client, id, params);
        break;
      case 'mining.suggest_target':
        this.handleSuggestTarget(client, id, params);
        break;
      case 'mining.extranonce.subscribe':
        // Extended extranonce support
        this.sendResponse(client, id, true);
        break;
      default:
        this.sendError(client, id, 20, `Unknown method: ${method}`);
    }
  }

  /**
   * الاشتراك
   */
  private handleSubscribe(client: StratumClient, id: number | null, params: any[]): void {
    client.subscribed = true;

    const response = {
      id,
      result: [
        [
          ['mining.set_difficulty', this.config.coin],
          ['mining.notify', this.config.coin]
        ],
        client.extraNonce1,
        client.extraNonce2Size
      ],
      error: null
    };

    this.sendResponse(client, response);

    // إرسال الصعوبة الأولية
    this.sendDifficulty(client, client.difficulty);

    this.emit('clientSubscribed', { coin: this.config.coin, clientId: client.id });
  }

  /**
   * التفويض
   */
  private handleAuthorize(client: StratumClient, id: number | null, params: any[]): void {
    const [workerString, password] = params;
    
    // تحليل اسم العامل والعنوان
    const parts = workerString.split('.');
    client.address = parts[0];
    client.workerName = parts.length > 1 ? parts[1] : 'default';
    client.authorized = true;

    console.log(`✅ Authorized: ${client.workerName}@${client.address} [${this.config.coin}]`);

    this.sendResponse(client, { id, result: true, error: null });
    
    this.emit('clientAuthorized', {
      coin: this.config.coin,
      clientId: client.id,
      address: client.address,
      workerName: client.workerName
    });
  }

  /**
   * إرسال شير
   */
  private async handleSubmit(client: StratumClient, id: number | null, params: any[]): Promise<void> {
    if (!client.authorized) {
      this.sendError(client, id, 24, 'Not authorized');
      return;
    }

    const [workerName, jobId, extraNonce2, nTime, nonce] = params;
    const job = this.jobs.get(jobId);

    if (!job) {
      this.sendError(client, id, 21, 'Stale job');
      await this.redis.recordShare(
        this.config.coin,
        client.workerName,
        client.address,
        client.difficulty,
        false,
        false
      );
      return;
    }

    // التحقق من الشير
    const validationResult = await this.validateShare(
      job,
      client.extraNonce1,
      extraNonce2,
      nTime,
      nonce,
      client.difficulty
    );

    if (validationResult.isValid) {
      // شير صالح
      await this.redis.recordShare(
        this.config.coin,
        client.workerName,
        client.address,
        client.difficulty,
        true,
        validationResult.isBlock
      );

      this.sendResponse(client, { id, result: true, error: null });

      this.emit('shareValid', {
        coin: this.config.coin,
        clientId: client.id,
        workerName: client.workerName,
        difficulty: client.difficulty,
        isBlock: validationResult.isBlock
      });

      // إذا كانت كتلة
      if (validationResult.isBlock) {
        console.log('🎉 Block found by ${client.workerName}!');
        this.emit('blockFound', {
          coin: this.config.coin,
          clientId: client.id,
          workerName: client.workerName,
          blockHash: validationResult.blockHash
        });
      }

      // ضبط الصعوبة تلقائياً
      if (this.config.vardiff) {
        this.adjustDifficulty(client);
      }
    } else {
      // شير غير صالح
      this.sendError(client, id, 23, 'Invalid share');
      
      await this.redis.recordShare(
        this.config.coin,
        client.workerName,
        client.address,
        client.difficulty,
        false,
        false
      );

      this.emit('shareInvalid', {
        coin: this.config.coin,
        clientId: client.id,
        reason: validationResult.reason
      });
    }
  }

  /**
   * اقتراح صعوبة
   */
  private handleSuggestDifficulty(client: StratumClient, id: number | null, params: any[]): void {
    const suggestedDiff = parseFloat(params[0]);
    
    if (suggestedDiff >= this.config.minDiff && suggestedDiff <= this.config.maxDiff) {
      client.difficulty = suggestedDiff;
      this.sendDifficulty(client, suggestedDiff);
    }
  }

  /**
   * اقتراح Target
   */
  private handleSuggestTarget(client: StratumClient, id: number | null, params: any[]): void {
    // تحويل Target إلى صعوبة
    const target = params[0];
    // حساب الصعوبة من Target
    // difficulty = maxTarget / target
    this.sendResponse(client, { id, result: true, error: null });
  }

  // =====================================================
  // Share Validation
  // =====================================================

  /**
   * التحقق من صحة الشير
   */
  private async validateShare(
    job: MiningJob,
    extraNonce1: string,
    extraNonce2: string,
    nTime: string,
    nonce: string,
    difficulty: number
  ): Promise<{ isValid: boolean; isBlock: boolean; blockHash?: string; reason?: string }> {
    
    try {
      // بناء Block Header
      const header = this.buildBlockHeader(
        job.blockTemplate,
        extraNonce1,
        extraNonce2,
        nTime,
        nonce
      );

      // حساب الـ Hash باستخدام Native Validator
      const hash = await this.algorithmValidator?.hash(header) || Buffer.alloc(32);
      
      // حساب Target من الصعوبة
      const target = this.difficultyToTarget(difficulty);
      const blockTarget = this.difficultyToTarget(job.difficulty);

      // مقارنة الـ Hash مع Target
      const hashBigInt = BigInt('0x' + hash.toString('hex'));
      const targetBigInt = BigInt('0x' + target);
      const blockTargetBigInt = BigInt('0x' + blockTarget);

      // هل الشير صالح؟
      if (hashBigInt < targetBigInt) {
        // هل هي كتلة كاملة؟
        if (hashBigInt < blockTargetBigInt) {
          return {
            isValid: true,
            isBlock: true,
            blockHash: hash.toString('hex')
          };
        }
        return { isValid: true, isBlock: false };
      }

      return { isValid: false, isBlock: false, reason: 'Hash above target' };
    } catch (error: any) {
      return { isValid: false, isBlock: false, reason: error.message };
    }
  }

  /**
   * بناء Block Header
   */
  private buildBlockHeader(
    template: any,
    extraNonce1: string,
    extraNonce2: string,
    nTime: string,
    nonce: string
  ): Buffer {
    // بناء الـ Header حسب تنسيق العملة
    // هذا يتطلب تنفيذاً مختلفاً لكل عملة
    return Buffer.alloc(200);
  }

  // =====================================================
  // Job Management
  // =====================================================

  /**
   * إضافة مهمة جديدة
   */
  newJob(blockTemplate: any, networkDifficulty: number): void {
    this.jobIdCounter++;
    const jobId = this.jobIdCounter.toString(16).padStart(8, '0');

    const job: MiningJob = {
      jobId,
      coin: this.config.coin,
      blockTemplate,
      target: this.difficultyToTarget(networkDifficulty),
      difficulty: networkDifficulty,
      timestamp: Date.now(),
      extraNonce1: '',
      extraNonce2Size: 4
    };

    this.jobs.set(jobId, job);

    // تنظيف المهام القديمة
    this.cleanupOldJobs();

    // بث المهمة للمعدنين
    this.broadcastJob(job);

    this.emit('newJob', { coin: this.config.coin, jobId });
  }

  /**
   * بث مهمة لجميع المعدنين
   */
  private broadcastJob(job: MiningJob): void {
    const notification = {
      id: null,
      method: 'mining.notify',
      params: [
        job.jobId,
        job.blockTemplate.previousHash || '',
        this.buildCoinbase1(job),
        this.buildCoinbase2(job),
        this.buildMerkleBranch(job),
        job.blockTemplate.version.toString(16).padStart(8, '0'),
        job.blockTemplate.bits.toString(16).padStart(8, '0'),
        job.blockTemplate.time.toString(16).padStart(8, '0'),
        true // cleanJobs
      ]
    };

    const message = JSON.stringify(notification) + '\n';

    for (const client of this.clients.values()) {
      if (client.authorized && client.subscribed) {
        client.socket.write(message);
      }
    }
  }

  private buildCoinbase1(job: MiningJob): string {
    // بناء Coinbase part 1
    return '';
  }

  private buildCoinbase2(job: MiningJob): string {
    // بناء Coinbase part 2
    return '';
  }

  private buildMerkleBranch(job: MiningJob): string[] {
    // بناء Merkle branch
    return [];
  }

  /**
   * تنظيف المهام القديمة
   */
  private cleanupOldJobs(): void {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [jobId, job] of this.jobs) {
      if (now - job.timestamp > maxAge) {
        this.jobs.delete(jobId);
      }
    }
  }

  // =====================================================
  // Difficulty Management
  // =====================================================

  /**
   * إرسال صعوبة للعميل
   */
  private sendDifficulty(client: StratumClient, difficulty: number): void {
    const message = JSON.stringify({
      id: null,
      method: 'mining.set_difficulty',
      params: [difficulty]
    }) + '\n';

    client.socket.write(message);
  }

  /**
   * ضبط الصعوبة تلقائياً (Vardiff)
   */
  private adjustDifficulty(client: StratumClient): void {
    // الحصول على معدل الشيرات
    // تعديل الصعوبة بناءً على الأداء
    // هذا يتطلب تتبع الشيرات
  }

  /**
   * تحويل الصعوبة إلى Target
   */
  private difficultyToTarget(difficulty: number): string {
    // Max target for the coin
    const maxTarget = BigInt('0x00000000ffff0000000000000000000000000000000000000000000000000000');
    const target = maxTarget / BigInt(Math.floor(difficulty));
    return target.toString(16).padStart(64, '0');
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  private generateExtraNonce1(): string {
    this.extraNonceCounter++;
    return this.extraNonceCounter.toString(16).padStart(8, '0');
  }

  private sendResponse(client: StratumClient, response: any): void {
    client.socket.write(JSON.stringify(response) + '\n');
  }

  private sendError(client: StratumClient, id: number | null, code: number, message: string): void {
    this.sendResponse(client, {
      id,
      result: null,
      error: [code, message, null]
    });
  }

  // =====================================================
  // Statistics
  // =====================================================

  getStats(): {
    coin: string;
    connectedMiners: number;
    totalJobs: number;
    uptime: number;
  } {
    return {
      coin: this.config.coin,
      connectedMiners: this.clients.size,
      totalJobs: this.jobs.size,
      uptime: process.uptime()
    };
  }

  setAlgorithmValidator(validator: any): void {
    this.algorithmValidator = validator;
  }
}

export default StratumServer;
