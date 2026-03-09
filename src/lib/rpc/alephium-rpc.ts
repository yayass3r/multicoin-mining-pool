/**
 * =====================================================
 * Alephium RPC Client - الإنتاج الحقيقي
 * =====================================================
 * 
 * عميل RPC حقيقي لشبكة Alephium
 * يستخدم Blake3 algorithm
 * 
 * @author Senior Blockchain Architect
 */

import { BaseRPCClient, BlockTemplate, SubmitResult, NetworkInfo, RPCConfig } from './base-rpc';
import https from 'https';
import http from 'http';

// =====================================================
// Alephium Types
// =====================================================

interface AlephiumBlockTemplate {
  fromGroup: number;
  toGroup: number;
  dependence: any;
  blockDeps: string[];
  txs: any[];
  target: string;
  blockTs: number;
  height: number;
  chainFrom: number;
  chainTo: number;
}

// =====================================================
// Alephium RPC Client
// =====================================================

export class AlephiumRPCClient extends BaseRPCClient {
  private apiKey: string = '';
  private lastBlockHeight: number = 0;

  constructor(config: RPCConfig & { apiKey?: string }) {
    super(config);
    this.apiKey = config.apiKey || '';
  }

  // =====================================================
  // Connection
  // =====================================================

  async connect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to Alephium node at ${this.config.host}:${this.config.port}...`);
      
      const info = await this.getChainInfo();
      
      if (info) {
        this.isConnected = true;
        this.syncStatus = true;
        
        console.log('✅ Connected to Alephium node');
        console.log(`   Network: ${info.networkId || 'mainnet'}`);
        console.log(`   Height: ${info.height}`);
        console.log(`   Group: ${info.numZones || 4} shards`);
        
        this.emit('connected');
        this.startSyncMonitor();
        
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Failed to connect to Alephium node:', error.message);
      this.emit('error', error);
      return false;
    }
  }

  // =====================================================
  // HTTP Request Override (REST API)
  // =====================================================

  protected async sendGetRequest<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.timeout);

      const options: http.RequestOptions = {
        hostname: this.config.host,
        port: this.config.port,
        path: path,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          ...(this.apiKey ? { 'X-API-KEY': this.apiKey } : {})
        }
      };

      const protocol = this.config.ssl ? https : http;
      
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Parse error: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      req.end();
    });
  }

  protected async sendPostRequest<T>(path: string, body: any): Promise<T> {
    const bodyStr = JSON.stringify(body);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.timeout);

      const options: http.RequestOptions = {
        hostname: this.config.host,
        port: this.config.port,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          ...(this.apiKey ? { 'X-API-KEY': this.apiKey } : {})
        }
      };

      const protocol = this.config.ssl ? https : http;
      
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Parse error: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      req.write(bodyStr);
      req.end();
    });
  }

  // =====================================================
  // Alephium Methods
  // =====================================================

  async getChainInfo(): Promise<{
    networkId: number;
    height: number;
    numZones: number;
  }> {
    const infos = await this.sendGetRequest<any>('/infos/chain');
    return {
      networkId: infos.networkId,
      height: infos.height,
      numZones: infos.numZones
    };
  }

  async getNetworkInfo(): Promise<NetworkInfo> {
    const chainInfo = await this.getChainInfo();
    
    return {
      version: 1,
      protocolVersion: '1.0',
      connections: 1,
      isSynced: this.syncStatus,
      networkHashrate: await this.getHashrate(),
      difficulty: await this.getDifficulty(),
      blockHeight: chainInfo.height
    };
  }

  async getHashrate(): Promise<number> {
    try {
      const result = await this.sendGetRequest<any>('/infos/hashrate');
      return result.hashrate || 0;
    } catch {
      return 0;
    }
  }

  async getDifficulty(): Promise<number> {
    try {
      const result = await this.sendGetRequest<any>('/infos/difficulty');
      return result.difficulty || 1;
    } catch {
      return 1;
    }
  }

  async getBlockTemplate(miningAddress: string): Promise<BlockTemplate> {
    if (!this.isConnected) {
      throw new Error('Not connected to Alephium node');
    }

    try {
      // Alephium uses block flow mining
      const response = await this.sendPostRequest<any>('/blockflow', {
        fromGroup: 0,
        toGroup: 0
      });

      const template: BlockTemplate = {
        version: 1,
        previousHash: response.blockDeps?.[0] || '',
        transactions: response.txs || [],
        coinbaseTxn: {},
        bits: 0,
        time: response.blockTs || Date.now(),
        height: response.height || 0,
        target: response.target || '',
        difficulty: await this.getDifficulty(),
        fromGroup: response.fromGroup,
        toGroup: response.toGroup,
        blockDeps: response.blockDeps || [],
        dependence: response.dependence
      };

      if (template.height !== this.lastBlockHeight) {
        this.lastBlockHeight = template.height;
        this.emit('newBlock', template);
      }

      this.currentTemplate = template;
      return template;
    } catch (error: any) {
      console.error('Failed to get block template:', error.message);
      throw error;
    }
  }

  async submitBlock(block: any): Promise<SubmitResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to Alephium node');
    }

    try {
      const response = await this.sendPostRequest<any>('/blockflow/submit', block);

      if (response.txId) {
        console.log('🎉 Alephium block accepted!');
        this.emit('blockAccepted', block);
        return { accepted: true, blockHash: response.txId };
      }

      return { accepted: false, message: 'Unknown response' };
    } catch (error: any) {
      console.error('Submit block error:', error.message);
      return { accepted: false, message: error.message };
    }
  }

  async getCurrentDifficulty(): Promise<{ difficulty: number; target: string; bits: number }> {
    const difficulty = await this.getDifficulty();
    return {
      difficulty,
      target: '',
      bits: 0
    };
  }

  async getBalance(address: string): Promise<{
    available: bigint;
    pending: bigint;
    total: bigint;
  }> {
    try {
      const response = await this.sendGetRequest<any>(`/addresses/${address}/balance`);
      
      return {
        available: BigInt(response.balance || '0'),
        pending: BigInt(response.lockedBalance || '0'),
        total: BigInt(response.balance || '0') + BigInt(response.lockedBalance || '0')
      };
    } catch (error) {
      return { available: BigInt(0), pending: BigInt(0), total: BigInt(0) };
    }
  }

  // =====================================================
  // Helpers
  // =====================================================

  private startSyncMonitor(): void {
    setInterval(async () => {
      if (!this.isConnected) return;
      
      try {
        await this.getChainInfo();
        this.syncStatus = true;
      } catch (error) {
        this.isConnected = false;
        this.syncStatus = false;
        this.emit('disconnected');
      }
    }, 30000);
  }
}

export default AlephiumRPCClient;
