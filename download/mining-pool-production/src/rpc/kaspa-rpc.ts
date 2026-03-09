/**
 * =====================================================
 * Kaspa RPC Client
 * =====================================================
 * 
 * عميل RPC حقيقي لشبكة Kaspa
 * يستخدم gRPC أو REST API للاتصال بالعقدة
 * 
 * @author Senior Blockchain Architect
 */

import { BaseRPCClient, BlockTemplate, SubmitResult, NetworkInfo, RPCConfig } from './base-rpc';
import http from 'http';
import https from 'https';
import EventEmitter from 'events';

// =====================================================
// Kaspa Block Types
// =====================================================

interface KaspaBlockHeader {
  version: number;
  hash: string;
  parents: string[];
  hashMerkleRoot: string;
  acceptedIdMerkleRoot: string;
  utxoCommitment: string;
  timestamp: number;
  bits: number;
  nonce: number;
  daaScore: string;
}

interface KaspaBlock {
  header: KaspaBlockHeader;
  transactions: any[];
  verboseData: any;
}

interface KaspaGetBlockTemplateResponse {
  block: KaspaBlock;
  isSynced: boolean;
  selectedParentHashes: string[];
}

// =====================================================
// Kaspa RPC Client Implementation
// =====================================================

export class KaspaRPCClient extends EventEmitter {
  private config: Required<RPCConfig>;
  private requestId: number = 0;
  private isConnected: boolean = false;
  private syncStatus: boolean = false;
  
  // Block template polling
  private pollInterval: NodeJS.Timeout | null = null;
  private currentTemplate: BlockTemplate | null = null;

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
      console.log(`🔌 Connecting to Kaspa node at ${this.config.host}:${this.config.port}...`);
      
      // Test connection with getInfo
      const info = await this.getInfo();
      
      if (info) {
        this.isConnected = true;
        console.log('✅ Connected to Kaspa node');
        console.log(`   Network: ${info.networkName || 'mainnet'}`);
        console.log(`   Version: ${info.version}`);
        console.log(`   Synced: ${info.isSynced}`);
        
        this.syncStatus = info.isSynced;
        this.emit('connected');
        
        // Start sync monitoring
        this.startSyncMonitor();
        
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Failed to connect to Kaspa node:', error.message);
      this.emit('error', error);
      return false;
    }
  }

  disconnect(): void {
    this.isConnected = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.emit('disconnected');
  }

  isNodeConnected(): boolean {
    return this.isConnected;
  }

  isSynced(): boolean {
    return this.syncStatus;
  }

  // =====================================================
  // RPC Requests
  // =====================================================

  private async sendRequest<T>(method: string, params: any = {}): Promise<T> {
    this.requestId++;
    
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: this.requestId,
      method,
      params
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('RPC request timeout'));
      }, this.config.timeout);

      const options = {
        hostname: this.config.host,
        port: this.config.port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
              reject(new Error(response.error.message || 'RPC Error'));
            } else {
              resolve(response.result);
            }
          } catch (e) {
            reject(new Error(`Parse error: ${data.slice(0, 100)}`));
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
  // Kaspa Specific Methods
  // =====================================================

  /**
   * جلب معلومات العقدة
   */
  async getInfo(): Promise<any> {
    try {
      return await this.sendRequest('getInfo');
    } catch (error) {
      throw error;
    }
  }

  /**
   * جلب معلومات DAG
   */
  async getBlockDagInfo(): Promise<{
    networkName: string;
    blockCount: string;
    headerCount: string;
    difficulty: number;
    pastMedianTime: string;
    virtualParentHashes: string[];
    pruningPointHash: string;
    daaScore: string;
  }> {
    return this.sendRequest('getBlockDagInfo');
  }

  /**
   * جلب قالب الكتلة (للتعدين)
   * هذا هو الجزء الأهم - جلب العمل الحقيقي
   */
  async getBlockTemplate(miningAddress: string): Promise<BlockTemplate> {
    if (!this.isConnected) {
      throw new Error('Not connected to Kaspa node');
    }

    try {
      const response: KaspaGetBlockTemplateResponse = await this.sendRequest('getBlockTemplate', {
        payAddress: miningAddress,
        extraData: Buffer.from('MultiCoin Mining Pool').toString('hex')
      });

      const block = response.block;
      const header = block.header;

      // تحويل لتنسيق موحد
      const template: BlockTemplate = {
        version: header.version,
        previousHash: header.parents?.[0] || '',
        transactions: block.transactions || [],
        coinbaseTxn: block.transactions?.[0] || {},
        bits: header.bits,
        time: header.timestamp,
        height: parseInt(header.daaScore || '0'),
        target: this.bitsToTarget(header.bits),
        difficulty: this.calculateDifficulty(header.bits),
        
        // Kaspa-specific fields
        hashMerkleRoot: header.hashMerkleRoot,
        acceptedIdMerkleRoot: header.acceptedIdMerkleRoot,
        utxoCommitment: header.utxoCommitment,
        daaScore: header.daaScore,
        selectedParentHashes: response.selectedParentHashes || [],
        parents: header.parents || [],
        isSynced: response.isSynced
      };

      this.currentTemplate = template;
      this.emit('newBlock', template);
      
      return template;
    } catch (error: any) {
      console.error('Failed to get block template:', error.message);
      throw error;
    }
  }

  /**
   * إرسال كتلة معدنية
   */
  async submitBlock(block: KaspaBlock): Promise<SubmitResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to Kaspa node');
    }

    try {
      const response = await this.sendRequest('submitBlock', {
        block: block
      });

      if (response.rejectReason) {
        console.log(`⚠️ Block rejected: ${response.rejectReason}`);
        return {
          accepted: false,
          message: response.rejectReason
        };
      }

      console.log('🎉 Block accepted!');
      this.emit('blockAccepted', block);
      
      return {
        accepted: true,
        blockHash: block.header.hash
      };
    } catch (error: any) {
      console.error('Submit block error:', error.message);
      return {
        accepted: false,
        message: error.message
      };
    }
  }

  /**
   * إرسال كتلة من بيانات raw
   */
  async submitBlockRaw(blockData: string): Promise<SubmitResult> {
    const block = JSON.parse(Buffer.from(blockData, 'hex').toString());
    return this.submitBlock(block);
  }

  /**
   * جلب الصعوبة الحالية
   */
  async getCurrentDifficulty(): Promise<{
    difficulty: number;
    target: string;
    bits: number;
  }> {
    const dagInfo = await this.getBlockDagInfo();
    const info = await this.getInfo();
    
    return {
      difficulty: dagInfo.difficulty || info.difficulty || 1,
      target: this.bitsToTarget(info.bits || 0x1b0404cb),
      bits: info.bits || 0x1b0404cb
    };
  }

  /**
   * جلب رصيد المحفظة
   */
  async getBalance(address: string): Promise<{
    available: bigint;
    pending: bigint;
    total: bigint;
  }> {
    try {
      const response = await this.sendRequest('getBalancesByAddresses', {
        addresses: [address]
      });

      const entry = response.entries?.[0] || {};
      return {
        available: BigInt(entry.available || '0'),
        pending: BigInt(entry.pending || '0'),
        total: BigInt(entry.total || '0')
      };
    } catch (error) {
      return { available: BigInt(0), pending: BigInt(0), total: BigInt(0) };
    }
  }

  /**
   * معلومات الشبكة
   */
  async getNetworkInfo(): Promise<NetworkInfo> {
    const info = await this.getInfo();
    const dagInfo = await this.getBlockDagInfo();
    
    return {
      version: info.version || 0,
      protocolVersion: info.protocolVersion || '1.0',
      connections: info.connections || 0,
      isSynced: info.isSynced || false,
      networkHashrate: this.calculateNetworkHashrate(dagInfo.difficulty),
      difficulty: dagInfo.difficulty || 1,
      blockHeight: parseInt(dagInfo.daaScore || '0')
    };
  }

  // =====================================================
  // Block Polling
  // =====================================================

  /**
   * بدء جلب قوالب الكتل تلقائياً
   */
  startBlockPolling(miningAddress: string, intervalMs: number = 500): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    const poll = async () => {
      if (!this.isConnected) return;
      
      try {
        const template = await this.getBlockTemplate(miningAddress);
        
        // التحقق من وجود كتلة جديدة
        if (this.currentTemplate && 
            template.time > this.currentTemplate.time) {
          this.emit('newJob', template);
        }
      } catch (error: any) {
        console.error('Poll error:', error.message);
      }
    };

    this.pollInterval = setInterval(poll, intervalMs);
    console.log(`📡 Block polling started (${intervalMs}ms)`);
  }

  stopBlockPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // =====================================================
  // Helper Functions
  // =====================================================

  /**
   * تحويل Bits إلى Target
   */
  private bitsToTarget(bits: number): string {
    const exponent = bits >> 24;
    const coefficient = bits & 0x007fffff;
    
    let target: bigint;
    if (exponent <= 3) {
      target = BigInt(coefficient >> (8 * (3 - exponent)));
    } else {
      target = BigInt(coefficient) << BigInt(8 * (exponent - 3));
    }
    
    // أقصى target لكاسبا
    const maxTarget = BigInt('0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    if (target > maxTarget) {
      target = maxTarget;
    }
    
    return target.toString(16).padStart(64, '0');
  }

  /**
   * حساب الصعوبة
   */
  private calculateDifficulty(bits: number): number {
    const target = BigInt('0x' + this.bitsToTarget(bits));
    const maxTarget = BigInt('0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    return Number(maxTarget / target);
  }

  /**
   * حساب معدل هاش الشبكة
   */
  private calculateNetworkHashrate(difficulty: number): number {
    // Kaspa: hashrate ≈ difficulty * 2 / blockTime
    // Block time ≈ 1 second
    return difficulty * 2 * 1e9; // تقدير بالـ GH/s
  }

  /**
   * مراقبة المزامنة
   */
  private startSyncMonitor(): void {
    setInterval(async () => {
      if (!this.isConnected) return;
      
      try {
        const info = await this.getInfo();
        const wasSynced = this.syncStatus;
        this.syncStatus = info.isSynced;
        
        if (this.syncStatus && !wasSynced) {
          this.emit('synced');
        } else if (!this.syncStatus && wasSynced) {
          this.emit('unsynced');
        }
      } catch (error) {
        // Connection lost
        this.isConnected = false;
        this.emit('disconnected');
      }
    }, 30000);
  }
}

export default KaspaRPCClient;
