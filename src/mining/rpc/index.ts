/**
 * =====================================================
 * 🔗 Production RPC Clients - عملاء RPC للإنتاج
 * =====================================================
 * 
 * اتصال حقيقي بالعُقد:
 * - Kaspa (kaspad)
 * - Ravencoin (ravend)
 * - Alephium
 * 
 * @author Lead Blockchain Architect
 */

import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';

// =====================================================
// Types
// =====================================================

export interface RPCConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  ssl?: boolean;
  timeout?: number;
}

export interface BlockTemplate {
  version: number;
  previousHash: string;
  transactions: any[];
  coinbaseTxn: any;
  bits: number;
  time: number;
  height: number;
  target: string;
  difficulty: number;
  [key: string]: any;
}

export interface SubmitResult {
  accepted: boolean;
  message?: string;
  blockHash?: string;
}

export interface NetworkInfo {
  version: number;
  protocolVersion: string;
  connections: number;
  isSynced: boolean;
  networkHashrate: number;
  difficulty: number;
  blockHeight: number;
}

// =====================================================
// Base RPC Client
// =====================================================

export abstract class BaseRPCClient extends EventEmitter {
  protected config: Required<RPCConfig>;
  protected requestId: number = 0;
  protected isConnected: boolean = false;
  protected isSynced: boolean = false;

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

  protected async sendRequest<T>(method: string, params: any = {}): Promise<T> {
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

      const options: http.RequestOptions = {
        hostname: this.config.host,
        port: this.config.port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        auth: this.config.user && this.config.password 
          ? `${this.config.user}:${this.config.password}` 
          : undefined
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

  abstract connect(): Promise<boolean>;
  abstract getBlockTemplate(address: string): Promise<BlockTemplate>;
  abstract submitBlock(block: any): Promise<SubmitResult>;
  abstract getNetworkInfo(): Promise<NetworkInfo>;

  disconnect(): void {
    this.isConnected = false;
    this.emit('disconnected');
  }

  isNodeConnected(): boolean {
    return this.isConnected;
  }

  isNodeSynced(): boolean {
    return this.isSynced;
  }
}

// =====================================================
// Kaspa RPC Client
// =====================================================

export class KaspaRPCClient extends BaseRPCClient {
  private lastBlockHeight: number = 0;

  async connect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to Kaspa node at ${this.config.host}:${this.config.port}...`);
      
      const info = await this.getInfo();
      
      if (info) {
        this.isConnected = true;
        this.isSynced = info.isSynced;
        
        console.log('✅ Connected to Kaspa node');
        console.log(`   Network: ${info.networkName || 'mainnet'}`);
        console.log(`   Version: ${info.version}`);
        console.log(`   Synced: ${info.isSynced}`);
        
        this.emit('connected');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Failed to connect to Kaspa node:', error.message);
      this.emit('error', error);
      return false;
    }
  }

  async getInfo(): Promise<any> {
    return this.sendRequest('getInfo');
  }

  async getBlockDagInfo(): Promise<{
    networkName: string;
    blockCount: string;
    headerCount: string;
    difficulty: number;
    daaScore: string;
  }> {
    return this.sendRequest('getBlockDagInfo');
  }

  async getBlockTemplate(address: string): Promise<BlockTemplate> {
    if (!this.isConnected) {
      throw new Error('Not connected to Kaspa node');
    }

    try {
      const response = await this.sendRequest<any>('getBlockTemplate', {
        payAddress: address,
        extraData: Buffer.from('Mining Pool').toString('hex')
      });

      const block = response.block;
      const header = block.header;

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
        hashMerkleRoot: header.hashMerkleRoot,
        acceptedIdMerkleRoot: header.acceptedIdMerkleRoot,
        utxoCommitment: header.utxoCommitment,
        daaScore: header.daaScore,
        parents: header.parents || [],
        isSynced: response.isSynced
      };

      if (template.height !== this.lastBlockHeight) {
        this.lastBlockHeight = template.height;
        this.emit('newBlock', template);
      }

      return template;
    } catch (error: any) {
      console.error('Failed to get block template:', error.message);
      throw error;
    }
  }

  async submitBlock(block: any): Promise<SubmitResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to Kaspa node');
    }

    try {
      const response = await this.sendRequest<any>('submitBlock', { block });

      if (response.rejectReason) {
        console.log(`⚠️ Block rejected: ${response.rejectReason}`);
        return { accepted: false, message: response.rejectReason };
      }

      console.log('🎉 Kaspa block accepted!');
      this.emit('blockAccepted', block);
      
      return { accepted: true, blockHash: block.header.hash };
    } catch (error: any) {
      return { accepted: false, message: error.message };
    }
  }

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

  async getBalance(address: string): Promise<{
    available: bigint;
    pending: bigint;
    total: bigint;
  }> {
    try {
      const response = await this.sendRequest<any>('getBalancesByAddresses', {
        addresses: [address]
      });

      const entry = response.entries?.[0] || {};
      return {
        available: BigInt(entry.available || '0'),
        pending: BigInt(entry.pending || '0'),
        total: BigInt(entry.total || '0')
      };
    } catch {
      return { available: BigInt(0), pending: BigInt(0), total: BigInt(0) };
    }
  }

  private bitsToTarget(bits: number): string {
    const exponent = bits >> 24;
    const coefficient = bits & 0x007fffff;
    
    let target: bigint;
    if (exponent <= 3) {
      target = BigInt(coefficient >> (8 * (3 - exponent)));
    } else {
      target = BigInt(coefficient) << BigInt(8 * (exponent - 3));
    }
    
    const maxTarget = BigInt('0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    if (target > maxTarget) target = maxTarget;
    
    return target.toString(16).padStart(64, '0');
  }

  private calculateDifficulty(bits: number): number {
    const target = BigInt('0x' + this.bitsToTarget(bits));
    const maxTarget = BigInt('0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    return Number(maxTarget / target);
  }

  private calculateNetworkHashrate(difficulty: number): number {
    return difficulty * 2 * 1e9;
  }
}

// =====================================================
// Ravencoin RPC Client
// =====================================================

export class RavencoinRPCClient extends BaseRPCClient {
  async connect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to Ravencoin node at ${this.config.host}:${this.config.port}...`);
      
      const info = await this.getBlockchainInfo();
      
      if (info) {
        this.isConnected = true;
        this.isSynced = !info.initialblockdownload;
        
        console.log('✅ Connected to Ravencoin node');
        console.log(`   Chain: ${info.chain}`);
        console.log(`   Blocks: ${info.blocks}`);
        console.log(`   Synced: ${this.isSynced}`);
        
        this.emit('connected');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Failed to connect to Ravencoin node:', error.message);
      return false;
    }
  }

  async getBlockchainInfo(): Promise<any> {
    return this.sendRequest('getblockchaininfo');
  }

  async getBlockTemplate(address: string): Promise<BlockTemplate> {
    if (!this.isConnected) {
      throw new Error('Not connected to Ravencoin node');
    }

    const response = await this.sendRequest<any>('getblocktemplate', [{
      rules: ['segwit'],
      capabilities: ['coinbasetxn', 'coinbasevalue', 'longpoll', 'workid'],
      mode: 'template'
    }]);

    return {
      version: response.version,
      previousHash: response.previousblockhash,
      transactions: response.transactions || [],
      coinbaseTxn: response.coinbasetxn || {},
      bits: parseInt(response.bits, 16),
      time: response.curtime,
      height: response.height,
      target: response.target,
      difficulty: response.difficulty
    };
  }

  async submitBlock(blockHex: string): Promise<SubmitResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to Ravencoin node');
    }

    try {
      const result = await this.sendRequest<any>('submitblock', [blockHex]);

      if (result === null) {
        console.log('🎉 Ravencoin block accepted!');
        return { accepted: true };
      }

      return { accepted: false, message: result };
    } catch (error: any) {
      return { accepted: false, message: error.message };
    }
  }

  async getNetworkInfo(): Promise<NetworkInfo> {
    const info = await this.sendRequest<any>('getnetworkinfo');
    const chainInfo = await this.getBlockchainInfo();
    
    return {
      version: info.version,
      protocolVersion: info.protocolversion,
      connections: info.connections,
      isSynced: !chainInfo.initialblockdownload,
      networkHashrate: await this.getNetworkHashPS(),
      difficulty: chainInfo.difficulty,
      blockHeight: chainInfo.blocks
    };
  }

  async getNetworkHashPS(blocks: number = 120): Promise<number> {
    try {
      return await this.sendRequest<number>('getnetworkhashps', [blocks]);
    } catch {
      return 0;
    }
  }
}

// =====================================================
// Alephium RPC Client
// =====================================================

export class AlephiumRPCClient extends BaseRPCClient {
  private apiKey: string = '';

  constructor(config: RPCConfig & { apiKey?: string }) {
    super(config);
    this.apiKey = config.apiKey || '';
  }

  protected async sendGetRequest<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Request timeout')), this.config.timeout);

      const options: http.RequestOptions = {
        hostname: this.config.host,
        port: this.config.port,
        path,
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
          } catch {
            reject(new Error(`Parse error`));
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

  async connect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to Alephium node at ${this.config.host}:${this.config.port}...`);
      
      const info = await this.getChainInfo();
      
      if (info) {
        this.isConnected = true;
        this.isSynced = true;
        
        console.log('✅ Connected to Alephium node');
        console.log(`   Network: ${info.networkId}`);
        console.log(`   Height: ${info.height}`);
        
        this.emit('connected');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Failed to connect to Alephium node:', error.message);
      return false;
    }
  }

  async getChainInfo(): Promise<{ networkId: number; height: number }> {
    return this.sendGetRequest('/infos/chain');
  }

  async getBlockTemplate(address: string): Promise<BlockTemplate> {
    if (!this.isConnected) {
      throw new Error('Not connected to Alephium node');
    }

    // Alephium uses block flow mining
    const response = await this.sendGetRequest<any>(`/blockflow?fromGroup=0&toGroup=0`);

    return {
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
      blockDeps: response.blockDeps || []
    };
  }

  async submitBlock(block: any): Promise<SubmitResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to Alephium node');
    }

    try {
      const response = await this.sendRequest<any>('/blockflow/submit', block);

      if (response.txId) {
        console.log('🎉 Alephium block accepted!');
        return { accepted: true, blockHash: response.txId };
      }

      return { accepted: false, message: 'Unknown response' };
    } catch (error: any) {
      return { accepted: false, message: error.message };
    }
  }

  async getNetworkInfo(): Promise<NetworkInfo> {
    const chainInfo = await this.getChainInfo();
    
    return {
      version: 1,
      protocolVersion: '1.0',
      connections: 1,
      isSynced: true,
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
    } catch {
      return { available: BigInt(0), pending: BigInt(0), total: BigInt(0) };
    }
  }
}

export { KaspaRPCClient, RavencoinRPCClient, AlephiumRPCClient };
