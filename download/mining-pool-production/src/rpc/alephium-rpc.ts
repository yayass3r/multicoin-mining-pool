/**
 * =====================================================
 * Alephium RPC Client (Blake3)
 * =====================================================
 * 
 * عميل RPC حقيقي لشبكة Alephium
 * 
 * @author Senior Blockchain Architect
 */

import { BaseRPCClient, BlockTemplate, SubmitResult, NetworkInfo, RPCConfig } from './base-rpc';
import http from 'http';
import https from 'https';
import EventEmitter from 'events';

// =====================================================
// Alephium Block Types
// =====================================================

interface AlephiumBlockHeader {
  version: number;
  depStateHash: string;
  txsHash: string;
  timestamp: number;
  chainFrom: number;
  chainTo: number;
  height: number;
  nonce: string;
  target: string;
  depStateHashCloses: string;
  txsHashCloses: string;
}

interface AlephiumBlockTemplate {
  version: number;
  depStateHash: string;
  txsHash: string;
  timestamp: number;
  target: string;
  blockDeps: string[];
  depStateHashCloses: string[];
  txsHashCloses: string[];
  transactions: any[];
  blockFee: number;
  miningCount: number;
  chainIndex: {
    from: number;
    to: number;
  };
  height: number;
}

interface AlephiumChainInfo {
  currentHeight: number;
  currentIndex: { from: number; to: number };
  target: string;
  difficulty: string;
  hashrate: string;
}

// =====================================================
// Alephium RPC Client
// =====================================================

export class AlephiumRPCClient extends EventEmitter {
  private config: Required<RPCConfig>;
  private isConnected: boolean = false;
  private syncStatus: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private currentTemplate: BlockTemplate | null = null;

  // Alephium uses multiple chains (shards)
  private readonly CHAIN_COUNT = 4;
  private currentChainIndex = { from: 0, to: 0 };

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
      console.log(`🔌 Connecting to Alephium node at ${this.config.host}:${this.config.port}...`);
      
      const info = await this.getChainInfo();
      
      this.isConnected = true;
      this.syncStatus = true; // Alephium doesn't have sync status directly
      
      console.log('✅ Connected to Alephium node');
      console.log(`   Height: ${info.currentHeight}`);
      console.log(`   Chain: ${info.currentIndex.from} → ${info.currentIndex.to}`);
      
      this.emit('connected');
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to connect to Alephium node:', error.message);
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
  // HTTP Requests
  // =====================================================

  private async sendRequest<T>(method: string, endpoint: string, params: any = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const body = method === 'GET' ? null : JSON.stringify(params);
      const path = endpoint.startsWith('/') ? endpoint : `/addresses/${endpoint}`;

      const options = {
        hostname: this.config.host,
        port: this.config.port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
        }
      };

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.timeout);

      const protocol = this.config.ssl ? https : http;

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 100)}`));
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

      if (body) req.write(body);
      req.end();
    });
  }

  // =====================================================
  // Chain Info
  // =====================================================

  async getChainInfo(): Promise<AlephiumChainInfo> {
    // Alephium REST API
    const info = await this.sendRequest<any>('GET', '/infos/chain');
    return {
      currentHeight: info.currentHeight || 0,
      currentIndex: info.currentIndex || { from: 0, to: 0 },
      target: info.target || '0',
      difficulty: info.difficulty || '0',
      hashrate: info.hashrate || '0'
    };
  }

  /**
   * جلب معلومات جميع السلاسل
   */
  async getAllChainsInfo(): Promise<AlephiumChainInfo[]> {
    const chains: AlephiumChainInfo[] = [];
    
    for (let from = 0; from < this.CHAIN_COUNT; from++) {
      for (let to = 0; to < this.CHAIN_COUNT; to++) {
        if (from !== to) {
          try {
            const info = await this.sendRequest<any>('GET', `/infos/chain?from=${from}&to=${to}`);
            chains.push({
              currentHeight: info.currentHeight || 0,
              currentIndex: { from, to },
              target: info.target || '0',
              difficulty: info.difficulty || '0',
              hashrate: info.hashrate || '0'
            });
          } catch (e) {
            // Skip failed chain
          }
        }
      }
    }
    
    return chains;
  }

  // =====================================================
  // Block Template
  // =====================================================

  /**
   * جلب قالب الكتلة للتعدين
   */
  async getBlockTemplate(miningAddress: string, chainIndex?: { from: number; to: number }): Promise<BlockTemplate> {
    if (!this.isConnected) {
      throw new Error('Not connected to Alephium node');
    }

    const chainFrom = chainIndex?.from ?? this.currentChainIndex.from;
    const chainTo = chainIndex?.to ?? this.currentChainIndex.to;

    try {
      // الحصول على block template
      const template = await this.sendRequest<AlephiumBlockTemplate>('POST', '/blockflow/templates', {
        address: miningAddress,
        chainFrom,
        chainTo
      });

      // تحويل للتنسيق الموحد
      const result: BlockTemplate = {
        version: template.version,
        previousHash: template.depStateHash,
        transactions: template.transactions || [],
        coinbaseTxn: this.createCoinbaseTx(template, miningAddress),
        bits: this.targetToBits(template.target),
        time: template.timestamp,
        height: template.height,
        target: template.target,
        difficulty: parseFloat(template.transactions?.length > 0 ? '1' : '0'),
        merkleroot: template.txsHash,
        
        // Alephium specific
        depStateHash: template.depStateHash,
        txsHash: template.txsHash,
        blockDeps: template.blockDeps || [],
        blockFee: template.blockFee || 0,
        miningCount: template.miningCount || 1,
        chainIndex: template.chainIndex || { from: chainFrom, to: chainTo }
      };

      this.currentTemplate = result;
      this.emit('newBlock', result);
      
      return result;
    } catch (error: any) {
      console.error('Failed to get Alephium block template:', error.message);
      throw error;
    }
  }

  /**
   * إنشاء معاملة Coinbase
   */
  private createCoinbaseTx(template: AlephiumBlockTemplate, miningAddress: string): any {
    return {
      hash: 'coinbase_placeholder',
      version: 0,
      inputs: [],
      outputs: [
        {
          address: miningAddress,
          amount: template.blockFee || 3, // Alephium block reward
          lockTime: 0
        }
      ],
      coinbase: true
    };
  }

  // =====================================================
  // Submit Block
  // =====================================================

  /**
   * إرسال كتلة معدنية
   */
  async submitBlock(block: any): Promise<SubmitResult> {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    try {
      const result = await this.sendRequest<any>('POST', '/blockflow/submit', {
        block: block
      });

      if (result.blockHash) {
        console.log('🎉 Alephium block accepted!');
        this.emit('blockAccepted', block);
        return { accepted: true, blockHash: result.blockHash };
      }

      return { accepted: false, message: result.message || 'Unknown error' };
    } catch (error: any) {
      return { accepted: false, message: error.message };
    }
  }

  /**
   * إرسال كتلة من بيانات raw
   */
  async submitBlockRaw(blockData: string): Promise<SubmitResult> {
    try {
      const block = JSON.parse(blockData);
      return this.submitBlock(block);
    } catch (error: any) {
      return { accepted: false, message: error.message };
    }
  }

  // =====================================================
  // Balance
  // =====================================================

  async getBalance(address: string): Promise<{ available: bigint; pending: bigint; total: bigint }> {
    try {
      const balance = await this.sendRequest<any>('GET', `/addresses/${address}/balance`);
      
      return {
        available: BigInt(balance.balance || '0'),
        pending: BigInt(balance.lockedBalance || '0'),
        total: BigInt(balance.balance || '0') + BigInt(balance.lockedBalance || '0')
      };
    } catch {
      return { available: BigInt(0), pending: BigInt(0), total: BigInt(0) };
    }
  }

  /**
   * جلب معاملات العنوان
   */
  async getAddressTransactions(address: string, limit: number = 10): Promise<any[]> {
    try {
      const result = await this.sendRequest<any>('GET', `/addresses/${address}/transactions?limit=${limit}`);
      return result || [];
    } catch {
      return [];
    }
  }

  // =====================================================
  // Network Info
  // =====================================================

  async getNetworkInfo(): Promise<NetworkInfo> {
    const chainInfo = await this.getChainInfo();
    const info = await this.sendRequest<any>('GET', '/infos/node');
    
    return {
      version: info?.version || 0,
      protocolVersion: info?.releaseVersion || '1.0',
      connections: info?.connections || 0,
      isSynced: true,
      networkHashrate: parseFloat(chainInfo.hashrate) || 0,
      difficulty: parseFloat(chainInfo.difficulty) || 0,
      blockHeight: chainInfo.currentHeight
    };
  }

  // =====================================================
  // Chain Management
  // =====================================================

  /**
   * اختيار أفضل سلسلة للتعدين
   */
  async selectBestChain(): Promise<{ from: number; to: number }> {
    const chains = await this.getAllChainsInfo();
    
    // اختيار السلسلة بأعلى مكافأة أو أقل صعوبة
    let bestChain = { from: 0, to: 1 };
    let bestScore = 0;
    
    for (const chain of chains) {
      const score = chain.currentHeight - parseFloat(chain.difficulty);
      if (score > bestScore) {
        bestScore = score;
        bestChain = chain.currentIndex;
      }
    }
    
    this.currentChainIndex = bestChain;
    return bestChain;
  }

  /**
   * تدوير السلاسل للتعدين
   */
  rotateChain(): void {
    const nextTo = (this.currentChainIndex.to + 1) % this.CHAIN_COUNT;
    const nextFrom = this.currentChainIndex.from;
    
    if (nextTo === this.currentChainIndex.from) {
      this.currentChainIndex.from = (this.currentChainIndex.from + 1) % this.CHAIN_COUNT;
      this.currentChainIndex.to = (this.currentChainIndex.from + 1) % this.CHAIN_COUNT;
    } else {
      this.currentChainIndex.to = nextTo;
    }
  }

  // =====================================================
  // Block Polling
  // =====================================================

  startBlockPolling(miningAddress: string, intervalMs: number = 1000): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    const poll = async () => {
      if (!this.isConnected) return;
      
      try {
        const template = await this.getBlockTemplate(miningAddress, this.currentChainIndex);
        
        if (this.currentTemplate && template.time > this.currentTemplate.time) {
          this.emit('newJob', template);
        }
      } catch (error: any) {
        console.error('ALPH poll error:', error.message);
      }
    };

    this.pollInterval = setInterval(poll, intervalMs);
    console.log(`📡 Alephium block polling started (${intervalMs}ms)`);
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

  private targetToBits(target: string): number {
    const targetBigInt = BigInt('0x' + target);
    let nSize = 0;
    let nCompact = targetBigInt;
    
    while (nCompact > BigInt(0x007fffff)) {
      nCompact >>= 8n;
      nSize++;
    }
    
    if (nCompact & BigInt(0x00800000)) {
      nCompact >>= 8n;
      nSize++;
    }
    
    return Number(nCompact) | (nSize << 24);
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

  getCurrentChain(): { from: number; to: number } {
    return { ...this.currentChainIndex };
  }
}

export default AlephiumRPCClient;
