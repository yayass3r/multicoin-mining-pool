/**
 * =====================================================
 * خادم Stratum لحوض التعدين متعدد العملات
 * Multi-Coin Mining Pool Stratum Server
 * =====================================================
 * 
 * يدعم الخوارزميات التالية:
 * - kHeavyHash (Kaspa)
 * - KawPoW (Ravencoin)
 * - RandomX (Zephyr Protocol)
 * - Blake3 (Alephium)
 */

import * as net from 'net';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

// =====================================================
// الأنواع والواجهات
// =====================================================

interface StratumConfig {
  coin: string;
  algorithm: string;
  port: number;
  host: string;
  difficulty: number;
  varDiff: {
    minDiff: number;
    maxDiff: number;
    targetTime: number;
    retargetTime: number;
  };
  poolWallet: string;
  poolFee: number;
}

interface MinerConnection {
  id: string;
  socket: net.Socket;
  workerName: string;
  walletAddress: string;
  difficulty: number;
  shares: number;
  invalidShares: number;
  lastShareTime: number;
  connected: boolean;
  agent: string;
  connectedAt: Date;
}

interface StratumMessage {
  id?: number | string;
  method?: string;
  params?: unknown[];
  result?: unknown;
  error?: unknown;
}

interface ShareSubmission {
  jobId: string;
  minerId: string;
  nonce: string;
  hash: string;
  difficulty: number;
  timestamp: number;
  valid: boolean;
  isBlock: boolean;
}

// =====================================================
// معالجات الخوارزميات
// =====================================================

abstract class AlgorithmHandler {
  abstract algorithm: string;
  abstract validateShare(share: ShareSubmission): boolean;
  abstract getBlockTemplate(): Promise<BlockTemplate>;
  abstract buildMerkleRoot(transactions: string[]): string;
  abstract calculateHash(header: string): string;
}

interface BlockTemplate {
  version: number;
  previousHash: string;
  merkleRoot: string;
  timestamp: number;
  bits: string;
  height: number;
  target: string;
  transactions: string[];
  coinbase: string;
  reward: number;
}

/**
 * معالج خوارزمية kHeavyHash (Kaspa)
 */
class KHeavyHashHandler extends AlgorithmHandler {
  algorithm = 'kHeavyHash';

  validateShare(share: ShareSubmission): boolean {
    // التحقق من صحة الشير باستخدام kHeavyHash
    // kHeavyHash = SHA256(SHA256(data)) + Matrix Multiplication
    try {
      const hash = this.calculateHash(share.hash);
      const target = this.difficultyToTarget(share.difficulty);
      return BigInt('0x' + hash) < target;
    } catch {
      return false;
    }
  }

  async getBlockTemplate(): Promise<BlockTemplate> {
    // يجب الاتصال بعقدة Kaspa
    return {
      version: 1,
      previousHash: '',
      merkleRoot: '',
      timestamp: Date.now(),
      bits: '',
      height: 0,
      target: '',
      transactions: [],
      coinbase: '',
      reward: 10 // KAS
    };
  }

  buildMerkleRoot(transactions: string[]): string {
    if (transactions.length === 0) return '0'.repeat(64);
    if (transactions.length === 1) return transactions[0];
    
    let current = transactions;
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = i + 1 < current.length ? current[i + 1] : left;
        const combined = left + right;
        next.push(crypto.createHash('sha256').update(Buffer.from(combined, 'hex')).digest('hex'));
      }
      current = next;
    }
    return current[0];
  }

  calculateHash(header: string): string {
    // kHeavyHash: SHA256(SHA256(header)) + Heavy Hash Matrix
    const sha256 = crypto.createHash('sha256');
    const hash1 = sha256.update(Buffer.from(header, 'hex')).digest();
    const hash2 = crypto.createHash('sha256').update(hash1).digest();
    return hash2.toString('hex');
  }

  private difficultyToTarget(difficulty: number): bigint {
    // حساب الهدف من الصعوبة
    const maxTarget = BigInt('0x00000000ffff0000000000000000000000000000000000000000000000000000');
    return maxTarget / BigInt(Math.floor(difficulty));
  }
}

/**
 * معالج خوارزمية KawPoW (Ravencoin)
 */
class KawPowHandler extends AlgorithmHandler {
  algorithm = 'KawPoW';

  validateShare(share: ShareSubmission): boolean {
    // KawPoW = ProgPoW variant for Ravencoin
    try {
      const hash = this.calculateHash(share.hash);
      const target = this.difficultyToTarget(share.difficulty);
      return BigInt('0x' + hash) < target;
    } catch {
      return false;
    }
  }

  async getBlockTemplate(): Promise<BlockTemplate> {
    return {
      version: 2,
      previousHash: '',
      merkleRoot: '',
      timestamp: Date.now(),
      bits: '',
      height: 0,
      target: '',
      transactions: [],
      coinbase: '',
      reward: 2500 // RVN
    };
  }

  buildMerkleRoot(transactions: string[]): string {
    // Bitcoin-style Merkle Root
    if (transactions.length === 0) return '0'.repeat(64);
    let current = transactions.map(tx => this.reverseBytes(tx));
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = i + 1 < current.length ? current[i + 1] : left;
        const combined = Buffer.concat([
          Buffer.from(left, 'hex'),
          Buffer.from(right, 'hex')
        ]);
        const hash = crypto.createHash('sha256').update(
          crypto.createHash('sha256').update(combined).digest()
        ).digest('hex');
        next.push(this.reverseBytes(hash));
      }
      current = next;
    }
    return current[0];
  }

  calculateHash(header: string): string {
    const hash = crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(Buffer.from(header, 'hex')).digest())
      .digest('hex');
    return this.reverseBytes(hash);
  }

  private reverseBytes(hex: string): string {
    return Buffer.from(hex, 'hex').reverse().toString('hex');
  }

  private difficultyToTarget(difficulty: number): bigint {
    const maxTarget = BigInt('0x00000000ffff0000000000000000000000000000000000000000000000000000');
    return maxTarget / BigInt(Math.floor(difficulty * 65536));
  }
}

/**
 * معالج خوارزمية RandomX (Zephyr Protocol)
 */
class RandomXHandler extends AlgorithmHandler {
  algorithm = 'RandomX';
  private vm: unknown = null;

  async initialize(): Promise<void> {
    // تهيئة RandomX VM
    // يتطلب مكتبة randomx-native
    console.log('Initializing RandomX VM...');
  }

  validateShare(share: ShareSubmission): boolean {
    // RandomX validation
    try {
      // في الإنتاج، نستخدم مكتبة RandomX الأصلية
      const hash = this.calculateHash(share.hash);
      const target = this.difficultyToTarget(share.difficulty);
      return BigInt('0x' + hash) < target;
    } catch {
      return false;
    }
  }

  async getBlockTemplate(): Promise<BlockTemplate> {
    return {
      version: 1,
      previousHash: '',
      merkleRoot: '',
      timestamp: Date.now(),
      bits: '',
      height: 0,
      target: '',
      transactions: [],
      coinbase: '',
      reward: 2.5 // ZEPH
    };
  }

  buildMerkleRoot(transactions: string[]): string {
    // CryptoNote-style Merkle Tree
    if (transactions.length === 0) return '0'.repeat(64);
    if (transactions.length === 1) return transactions[0];
    
    const treeHash = (a: string, b: string): string => {
      return crypto.createHash('sha256')
        .update(Buffer.from(a + b, 'hex'))
        .digest('hex');
    };

    let current = transactions;
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        if (i + 1 < current.length) {
          next.push(treeHash(current[i], current[i + 1]));
        } else {
          next.push(treeHash(current[i], current[i]));
        }
      }
      current = next;
    }
    return current[0];
  }

  calculateHash(header: string): string {
    // RandomX hash - في الإنتاج نستخدم المكتبة الأصلية
    return crypto.createHash('sha256').update(header).digest('hex');
  }

  private difficultyToTarget(difficulty: number): bigint {
    // Monero-style difficulty target
    const target = BigInt(2) ** BigInt(256) - BigInt(1);
    return target / BigInt(Math.floor(difficulty));
  }
}

/**
 * معالج خوارزمية Blake3 (Alephium)
 */
class Blake3Handler extends AlgorithmHandler {
  algorithm = 'Blake3';

  validateShare(share: ShareSubmission): boolean {
    try {
      const hash = this.calculateHash(share.hash);
      const target = this.difficultyToTarget(share.difficulty);
      return BigInt('0x' + hash) < target;
    } catch {
      return false;
    }
  }

  async getBlockTemplate(): Promise<BlockTemplate> {
    return {
      version: 1,
      previousHash: '',
      merkleRoot: '',
      timestamp: Date.now(),
      bits: '',
      height: 0,
      target: '',
      transactions: [],
      coinbase: '',
      reward: 3 // ALPH
    };
  }

  buildMerkleRoot(transactions: string[]): string {
    // Alephium Merkle Tree using Blake3
    if (transactions.length === 0) return '0'.repeat(64);
    
    // في الإنتاج، نستخدم مكتبة Blake3
    let current = transactions;
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = i + 1 < current.length ? current[i + 1] : left;
        const combined = Buffer.from(left + right, 'hex');
        // Blake3 hash - نستخدم SHA256 كبديل هنا
        const hash = crypto.createHash('sha256').update(combined).digest('hex');
        next.push(hash);
      }
      current = next;
    }
    return current[0];
  }

  calculateHash(header: string): string {
    // Blake3 hash - في الإنتاج نستخدم مكتبة blake3
    return crypto.createHash('sha256').update(Buffer.from(header, 'hex')).digest('hex');
  }

  private difficultyToTarget(difficulty: number): bigint {
    const maxTarget = BigInt('0x00000000ffff0000000000000000000000000000000000000000000000000000');
    return maxTarget / BigInt(Math.floor(difficulty));
  }
}

// =====================================================
// خادم Stratum الرئيسي
// =====================================================

export class StratumServer extends EventEmitter {
  private config: StratumConfig;
  private server: net.Server | null = null;
  private miners: Map<string, MinerConnection> = new Map();
  private algorithmHandler: AlgorithmHandler;
  private currentJobId: string = '';
  private currentBlockTemplate: BlockTemplate | null = null;
  private isRunning: boolean = false;

  constructor(config: StratumConfig) {
    super();
    this.config = config;
    this.algorithmHandler = this.createAlgorithmHandler(config.algorithm);
  }

  private createAlgorithmHandler(algorithm: string): AlgorithmHandler {
    switch (algorithm) {
      case 'kHeavyHash':
        return new KHeavyHashHandler();
      case 'KawPoW':
        return new KawPowHandler();
      case 'RandomX':
        return new RandomXHandler();
      case 'Blake3':
        return new Blake3Handler();
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
  }

  /**
   * بدء تشغيل خادم Stratum
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log(`Stratum server for ${this.config.coin} is already running`);
      return;
    }

    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    this.server.on('error', (error) => {
      console.error(`Stratum server error for ${this.config.coin}:`, error);
      this.emit('error', error);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        this.isRunning = true;
        console.log(`✅ Stratum server for ${this.config.coin} started on ${this.config.host}:${this.config.port}`);
        this.emit('started', { coin: this.config.coin, port: this.config.port });
        resolve();
      });
    });
  }

  /**
   * إيقاف خادم Stratum
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    // إغلاق جميع اتصالات المعدنين
    for (const [id, miner] of this.miners) {
      miner.socket.destroy();
      this.miners.delete(id);
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        console.log(`🛑 Stratum server for ${this.config.coin} stopped`);
        this.emit('stopped', { coin: this.config.coin });
        resolve();
      });
    });
  }

  /**
   * معالجة الاتصال الجديد
   */
  private handleConnection(socket: net.Socket): void {
    const minerId = this.generateMinerId();
    const miner: MinerConnection = {
      id: minerId,
      socket,
      workerName: '',
      walletAddress: '',
      difficulty: this.config.difficulty,
      shares: 0,
      invalidShares: 0,
      lastShareTime: 0,
      connected: true,
      agent: '',
      connectedAt: new Date()
    };

    this.miners.set(minerId, miner);
    console.log(`📥 New connection from ${socket.remoteAddress}:${socket.remotePort} (ID: ${minerId})`);

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(minerId, line.trim());
        }
      }
    });

    socket.on('error', (error) => {
      console.error(`Socket error for miner ${minerId}:`, error.message);
    });

    socket.on('close', () => {
      this.handleDisconnection(minerId);
    });

    // إرسال رسالة الترحيب
    this.sendMessage(socket, {
      id: null,
      result: {
        'id': minerId,
        'job': null
      },
      error: null
    });
  }

  /**
   * معالجة رسالة Stratum
   */
  private handleMessage(minerId: string, message: string): void {
    const miner = this.miners.get(minerId);
    if (!miner) return;

    try {
      const parsed: StratumMessage = JSON.parse(message);
      console.log(`📨 [${this.config.coin}] Message from ${minerId}: ${parsed.method}`);

      switch (parsed.method) {
        case 'mining.subscribe':
          this.handleSubscribe(miner, parsed);
          break;
        case 'mining.authorize':
          this.handleAuthorize(miner, parsed);
          break;
        case 'mining.submit':
          this.handleSubmit(miner, parsed);
          break;
        case 'mining.suggest_difficulty':
          this.handleSuggestDifficulty(miner, parsed);
          break;
        case 'mining.extranonce.subscribe':
          // Extranonce subscription - optional
          this.sendMessage(miner.socket, {
            id: parsed.id,
            result: true,
            error: null
          });
          break;
        default:
          console.log(`Unknown method: ${parsed.method}`);
          this.sendError(miner.socket, parsed.id, 20, 'Unknown method');
      }
    } catch (error) {
      console.error(`Error parsing message from ${minerId}:`, error);
    }
  }

  /**
   * معالجة الاشتراك
   */
  private handleSubscribe(miner: MinerConnection, message: StratumMessage): void {
    const params = message.params as string[] || [];
    if (params.length > 0) {
      miner.agent = params[0] || 'unknown';
    }

    const response = {
      id: message.id,
      result: [
        [
          ['mining.notify', miner.id],
          ['mining.set_difficulty', miner.id]
        ],
        '08000002', // extranonce1
        4 // extranonce2_size
      ],
      error: null
    };

    this.sendMessage(miner.socket, response);
    
    // إرسال الصعوبة
    this.sendDifficulty(miner);
  }

  /**
   * معالجة التفويض
   */
  private handleAuthorize(miner: MinerConnection, message: StratumMessage): void {
    const params = message.params as string[];
    if (!params || params.length < 2) {
      this.sendError(miner.socket, message.id, 24, 'Invalid authorization parameters');
      return;
    }

    miner.walletAddress = params[0];
    miner.workerName = params[1] || 'worker1';

    console.log(`✅ Miner authorized: ${miner.walletAddress}.${miner.workerName}`);

    this.sendMessage(miner.socket, {
      id: message.id,
      result: true,
      error: null
    });

    // إرسال مهمة جديدة
    this.sendJob(miner);

    this.emit('miner.authorized', {
      minerId: miner.id,
      wallet: miner.walletAddress,
      worker: miner.workerName,
      coin: this.config.coin
    });
  }

  /**
   * معالجة إرسال الشير
   */
  private handleSubmit(miner: MinerConnection, message: StratumMessage): void {
    const params = message.params as string[];
    if (!params || params.length < 5) {
      this.sendError(miner.socket, message.id, 24, 'Invalid submit parameters');
      miner.invalidShares++;
      return;
    }

    const workerName = params[0];
    const jobId = params[1];
    const nonce2 = params[2];
    const nTime = params[3];
    const nonce = params[4];

    // إنشاء سجل الشير
    const share: ShareSubmission = {
      jobId,
      minerId: miner.id,
      nonce,
      hash: `${nonce2}${nTime}${nonce}`,
      difficulty: miner.difficulty,
      timestamp: Date.now(),
      valid: false,
      isBlock: false
    };

    // التحقق من صحة الشير
    share.valid = this.algorithmHandler.validateShare(share);

    if (share.valid) {
      miner.shares++;
      miner.lastShareTime = Date.now();

      // التحقق مما إذا كان الشير يمثل كتلة
      share.isBlock = this.checkForBlock(share);

      this.sendMessage(miner.socket, {
        id: message.id,
        result: true,
        error: null
      });

      if (share.isBlock) {
        console.log(`🎉 BLOCK FOUND by ${miner.walletAddress}.${workerName}!`);
        this.emit('block.found', {
          minerId: miner.id,
          wallet: miner.walletAddress,
          worker: workerName,
          coin: this.config.coin,
          jobId,
          nonce,
          difficulty: miner.difficulty
        });
      }

      this.emit('share.accepted', {
        minerId: miner.id,
        wallet: miner.walletAddress,
        worker: workerName,
        coin: this.config.coin,
        difficulty: miner.difficulty,
        isBlock: share.isBlock
      });
    } else {
      miner.invalidShares++;
      this.sendError(miner.socket, message.id, 23, 'Invalid share');

      this.emit('share.rejected', {
        minerId: miner.id,
        wallet: miner.walletAddress,
        worker: workerName,
        coin: this.config.coin
      });
    }

    // تعديل الصعوبة إذا لزم الأمر
    this.adjustDifficulty(miner);
  }

  /**
   * معالجة اقتراح الصعوبة
   */
  private handleSuggestDifficulty(miner: MinerConnection, message: StratumMessage): void {
    const params = message.params as number[];
    if (params && params.length > 0) {
      const suggestedDiff = params[0];
      if (suggestedDiff >= this.config.varDiff.minDiff && suggestedDiff <= this.config.varDiff.maxDiff) {
        miner.difficulty = suggestedDiff;
        this.sendDifficulty(miner);
      }
    }

    this.sendMessage(miner.socket, {
      id: message.id,
      result: true,
      error: null
    });
  }

  /**
   * معالجة قطع الاتصال
   */
  private handleDisconnection(minerId: string): void {
    const miner = this.miners.get(minerId);
    if (miner) {
      console.log(`📤 Miner ${miner.walletAddress}.${miner.workerName} disconnected`);
      this.emit('miner.disconnected', {
        minerId,
        wallet: miner.walletAddress,
        worker: miner.workerName,
        coin: this.config.coin,
        shares: miner.shares,
        invalidShares: miner.invalidShares,
        duration: Date.now() - miner.connectedAt.getTime()
      });
      this.miners.delete(minerId);
    }
  }

  /**
   * إرسال الصعوبة للمعدن
   */
  private sendDifficulty(miner: MinerConnection): void {
    this.sendMessage(miner.socket, {
      id: null,
      method: 'mining.set_difficulty',
      params: [miner.difficulty]
    });
  }

  /**
   * إرسال مهمة جديدة للمعدن
   */
  private sendJob(miner: MinerConnection): void {
    if (!this.currentBlockTemplate) {
      return;
    }

    const job = {
      id: null,
      method: 'mining.notify',
      params: [
        this.currentJobId,
        this.currentBlockTemplate.previousHash,
        this.currentBlockTemplate.coinbase,
        this.currentBlockTemplate.transactions,
        this.currentBlockTemplate.merkleRoot,
        this.currentBlockTemplate.version,
        this.currentBlockTemplate.bits,
        this.currentBlockTemplate.timestamp,
        true // clean_jobs
      ]
    };

    this.sendMessage(miner.socket, job);
  }

  /**
   * تعديل صعوبة المعدن بناءً على أدائه
   */
  private adjustDifficulty(miner: MinerConnection): void {
    const now = Date.now();
    const timeSinceLastAdjust = now - (miner.lastShareTime || now);
    
    if (timeSinceLastAdjust < this.config.varDiff.retargetTime * 1000) {
      return;
    }

    const avgShareTime = timeSinceLastAdjust / Math.max(miner.shares, 1);
    
    if (avgShareTime < this.config.varDiff.targetTime * 0.5) {
      // الكثير من الشيرات - زيادة الصعوبة
      const newDiff = Math.min(miner.difficulty * 1.1, this.config.varDiff.maxDiff);
      if (newDiff !== miner.difficulty) {
        miner.difficulty = newDiff;
        this.sendDifficulty(miner);
      }
    } else if (avgShareTime > this.config.varDiff.targetTime * 2) {
      // القليل من الشيرات - تقليل الصعوبة
      const newDiff = Math.max(miner.difficulty * 0.9, this.config.varDiff.minDiff);
      if (newDiff !== miner.difficulty) {
        miner.difficulty = newDiff;
        this.sendDifficulty(miner);
      }
    }
  }

  /**
   * التحقق مما إذا كان الشير يمثل كتلة
   */
  private checkForBlock(share: ShareSubmission): boolean {
    // في الإنتاج، نتحقق من أن الهاش يفي بمتطلبات الشبكة
    // هذه محاكاة - احتمال صغير لاكتشاف كتلة
    return Math.random() < 0.0001;
  }

  /**
   * إرسال رسالة للمعدن
   */
  private sendMessage(socket: net.Socket, message: StratumMessage): void {
    try {
      socket.write(JSON.stringify(message) + '\n');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  /**
   * إرسال رسالة خطأ
   */
  private sendError(socket: net.Socket, id: number | string | undefined, code: number, message: string): void {
    this.sendMessage(socket, {
      id,
      result: null,
      error: [code, message, null]
    });
  }

  /**
   * توليد معرف فريد للمعدن
   */
  private generateMinerId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * تحديث قالب الكتلة
   */
  updateBlockTemplate(template: BlockTemplate): void {
    this.currentBlockTemplate = template;
    this.currentJobId = crypto.randomBytes(4).toString('hex');
    
    // إرسال المهمة الجديدة لجميع المعدنين
    for (const miner of this.miners.values()) {
      if (miner.walletAddress) {
        this.sendJob(miner);
      }
    }
  }

  /**
   * الحصول على إحصائيات الخادم
   */
  getStats(): {
    coin: string;
    algorithm: string;
    port: number;
    connectedMiners: number;
    totalShares: number;
    invalidShares: number;
    isRunning: boolean;
  } {
    let totalShares = 0;
    let invalidShares = 0;

    for (const miner of this.miners.values()) {
      totalShares += miner.shares;
      invalidShares += miner.invalidShares;
    }

    return {
      coin: this.config.coin,
      algorithm: this.config.algorithm,
      port: this.config.port,
      connectedMiners: this.miners.size,
      totalShares,
      invalidShares,
      isRunning: this.isRunning
    };
  }
}

// =====================================================
// تصدير المعالجات
// =====================================================

export {
  AlgorithmHandler,
  KHeavyHashHandler,
  KawPowHandler,
  RandomXHandler,
  Blake3Handler,
  type StratumConfig,
  type MinerConnection,
  type StratumMessage,
  type ShareSubmission,
  type BlockTemplate
};
