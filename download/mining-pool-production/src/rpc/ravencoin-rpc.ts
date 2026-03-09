/**
 * =====================================================
 * Ravencoin RPC Client (KawPoW)
 * =====================================================
 * 
 * عميل RPC حقيقي لشبكة Ravencoin
 * 
 * @author Senior Blockchain Architect
 */

import { BaseRPCClient, BlockTemplate, SubmitResult, NetworkInfo, RPCConfig } from './base-rpc';
import http from 'http';
import https from 'https';
import EventEmitter from 'events';

// =====================================================
// Ravencoin Block Types
// =====================================================

interface RavencoinBlockTemplate {
  id: string;
  version: number;
  previousHash: string;
  transactions: any[];
  coinbaseValue: number;
  target: string;
  mintime: number;
  maxtime: number;
  curtime: number;
  bits: string;
  height: number;
  difficulty: number;
  merkleroot: string;
  sigoplimit: number;
  sizelimit: number;
  weightlimit: number;
  capabilities: string[];
}

interface RavencoinSubmitResult {
  status: 'accepted' | 'rejected';
  rejectReason?: string;
}

// =====================================================
// Ravencoin RPC Client
// =====================================================

export class RavencoinRPCClient extends EventEmitter {
  private config: Required<RPCConfig>;
  private requestId: number = 0;
  private isConnected: boolean = false;
  private syncStatus: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private currentTemplate: BlockTemplate | null = null;

  // KawPoW cache
  private epochCache: Map<number, Buffer> = new Map();
  private readonly EPOCH_LENGTH = 7500;
  private readonly CACHE_INIT_SIZE = 16777216; // 16 MB

  constructor(config: RPCConfig) {
    super();
    this.config = {
      timeout: 30000,
      ssl: false,
      user: '',
      password: '',
      ...config
    };
  }

  // =====================================================
  // Connection
  // =====================================================

  async connect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to Ravencoin node at ${this.config.host}:${this.config.port}...`);
      
      const info = await this.getBlockchainInfo();
      
      this.isConnected = true;
      this.syncStatus = info.isSynced;
      
      console.log('✅ Connected to Ravencoin node');
      console.log(`   Blocks: ${info.blocks}`);
      console.log(`   Difficulty: ${info.difficulty}`);
      console.log(`   Synced: ${info.isSynced}`);
      
      this.emit('connected');
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to connect to Ravencoin node:', error.message);
      return false;
    }
  }

  disconnect(): void {
    this.isConnected = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.emit('disconnected');
  }

  // =====================================================
  // RPC Requests
  // =====================================================

  private async sendRequest<T>(method: string, params: any[] = []): Promise<T> {
    this.requestId++;
    
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: this.requestId,
      method,
      params
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('RPC timeout'));
      }, this.config.timeout);

      const auth = Buffer.from(`${this.config.user}:${this.config.password}`).toString('base64');
      
      const options = {
        hostname: this.config.host,
        port: this.config.port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const protocol = this.config.ssl ? https : http;
      
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            const response = JSON.parse(data);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          } catch (e) {
            reject(new Error('Parse error'));
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      req.write(body);
      req.end();
    });
  }

  // =====================================================
  // Blockchain Info
  // =====================================================

  async getBlockchainInfo(): Promise<{
    chain: string;
    blocks: number;
    headers: number;
    difficulty: number;
    isSynced: boolean;
  }> {
    const info = await this.sendRequest<any>('getblockchaininfo');
    return {
      chain: info.chain,
      blocks: info.blocks,
      headers: info.headers,
      difficulty: info.difficulty,
      isSynced: !info.initialblockdownload
    };
  }

  // =====================================================
  // Block Template
  // =====================================================

  async getBlockTemplate(miningAddress: string, capabilities: string[] = []): Promise<BlockTemplate> {
    if (!this.isConnected) {
      throw new Error('Not connected to Ravencoin node');
    }

    const defaultCapabilities = [
      'coinbasevalue',
      'workid',
      'coinbase/append',
      'coinbase',
      'generation',
      'time',
      'transactions/remove',
      'prevblock'
    ];

    const template = await this.sendRequest<RavencoinBlockTemplate>('getblocktemplate', [{
      rules: ['segwit'],
      capabilities: [...defaultCapabilities, ...capabilities]
    }]);

    // تحويل لتنسيق موحد
    const result: BlockTemplate = {
      version: template.version,
      previousHash: template.previousHash,
      transactions: template.transactions || [],
      coinbaseTxn: this.createCoinbaseTx(template, miningAddress),
      bits: parseInt(template.bits, 16),
      time: template.curtime,
      height: template.height,
      target: template.target,
      difficulty: template.difficulty,
      merkleroot: template.merkleroot || '',
      
      // RVN specific
      coinbaseValue: template.coinbaseValue,
      mintime: template.mintime,
      maxtime: template.maxtime,
      sigoplimit: template.sigoplimit,
      sizelimit: template.sizelimit
    };

    this.currentTemplate = result;
    this.emit('newBlock', result);
    
    return result;
  }

  /**
   * إنشاء معاملة Coinbase
   */
  private createCoinbaseTx(template: RavencoinBlockTemplate, miningAddress: string): any {
    const blockReward = template.coinbaseValue;
    
    return {
      data: 'coinbase_data_placeholder',
      hash: 'coinbase_hash_placeholder',
      depends: [],
      fee: 0,
      sigops: 0,
      coinbase: true,
      outputs: [
        {
          scriptPubKey: {
            addresses: [miningAddress]
          },
          value: blockReward
        }
      ]
    };
  }

  // =====================================================
  // Submit Block
  // =====================================================

  async submitBlock(blockData: string): Promise<SubmitResult> {
    try {
      const result = await this.sendRequest<RavencoinSubmitResult>('submitblock', [blockData]);
      
      if (result.status === 'accepted') {
        console.log('🎉 Ravencoin block accepted!');
        this.emit('blockAccepted');
        return { accepted: true };
      }
      
      return { accepted: false, message: result.rejectReason };
    } catch (error: any) {
      return { accepted: false, message: error.message };
    }
  }

  /**
   * إرسال كتلة (طريقة بديلة)
   */
  async submitBlockHex(blockHex: string): Promise<SubmitResult> {
    return this.submitBlock(blockHex);
  }

  // =====================================================
  // KawPoW Epoch & Cache
  // =====================================================

  /**
   * حساب الـ Epoch من رقم الكتلة
   */
  getEpoch(blockHeight: number): number {
    return Math.floor(blockHeight / this.EPOCH_LENGTH);
  }

  /**
   * جلب الـ Cache للـ Epoch
   */
  async getCache(epoch: number): Promise<Buffer> {
    if (this.epochCache.has(epoch)) {
      return this.epochCache.get(epoch)!;
    }

    // حساب حجم الـ Cache
    let cacheSize = this.CACHE_INIT_SIZE;
    for (let i = 0; i < epoch; i++) {
      cacheSize = Math.floor(cacheSize * 1024 / 100 + 128);
    }

    // إنشاء Cache جديد
    // في التطبيق الحقيقي، نحتاج إلى epoch block hash
    const cache = Buffer.alloc(cacheSize);
    
    // TODO: ملء الـ Cache بالبيانات الفعلية
    // هذا يتطلب الـ seed hash من الكتلة الأولى في الـ epoch
    
    this.epochCache.set(epoch, cache);
    return cache;
  }

  /**
   * جلب الـ DAG dataset للـ epoch
   */
  async getDataset(epoch: number): Promise<Buffer> {
    // Dataset حجمه أكبر بكثير من Cache
    // في الواقع، التعدين الخفيف يستخدم Cache فقط
    const cache = await this.getCache(epoch);
    return cache;
  }

  /**
   * حساب حجم الـ Cache للـ epoch
   */
  getCacheSize(epoch: number): number {
    let size = this.CACHE_INIT_SIZE;
    for (let i = 0; i < epoch; i++) {
      size = Math.floor(size * 1024 / 100 + 128);
    }
    return size;
  }

  // =====================================================
  // Network Info
  // =====================================================

  async getNetworkInfo(): Promise<NetworkInfo> {
    const info = await this.sendRequest<any>('getnetworkinfo');
    const blockchainInfo = await this.getBlockchainInfo();
    
    return {
      version: info.version,
      protocolVersion: info.protocolversion,
      connections: info.connections,
      isSynced: blockchainInfo.isSynced,
      networkHashrate: blockchainInfo.difficulty * 1e9, // تقريب
      difficulty: blockchainInfo.difficulty,
      blockHeight: blockchainInfo.blocks
    };
  }

  // =====================================================
  // Balance
  // =====================================================

  async getBalance(address: string): Promise<{ available: bigint; pending: bigint; total: bigint }> {
    try {
      const balance = await this.sendRequest<number>('getreceivedbyaddress', [address, 0]);
      return {
        available: BigInt(Math.floor(balance * 1e8)),
        pending: BigInt(0),
        total: BigInt(Math.floor(balance * 1e8))
      };
    } catch {
      return { available: BigInt(0), pending: BigInt(0), total: BigInt(0) };
    }
  }

  // =====================================================
  // Block Polling
  // =====================================================

  startBlockPolling(miningAddress: string, intervalMs: number = 500): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    const poll = async () => {
      if (!this.isConnected) return;
      
      try {
        const template = await this.getBlockTemplate(miningAddress);
        
        if (this.currentTemplate && template.time > this.currentTemplate.time) {
          this.emit('newJob', template);
        }
      } catch (error: any) {
        console.error('RVN poll error:', error.message);
      }
    };

    this.pollInterval = setInterval(poll, intervalMs);
    console.log(`📡 Ravencoin block polling started (${intervalMs}ms)`);
  }

  stopBlockPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // =====================================================
  // Status
  // =====================================================

  isNodeConnected(): boolean {
    return this.isConnected;
  }

  isSynced(): boolean {
    return this.syncStatus;
  }
}

export default RavencoinRPCClient;
