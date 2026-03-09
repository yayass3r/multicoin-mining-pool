/**
 * =====================================================
 * Ravencoin RPC Client - الإنتاج الحقيقي
 * =====================================================
 * 
 * عميل RPC حقيقي لشبكة Ravencoin
 * يستخدم KawPoW algorithm
 * 
 * @author Senior Blockchain Architect
 */

import { BaseRPCClient, BlockTemplate, SubmitResult, NetworkInfo, RPCConfig } from './base-rpc';

// =====================================================
// Ravencoin Types
// =====================================================

interface RavencoinBlockTemplate {
  version: number;
  previousblockhash: string;
  transactions: any[];
  coinbasetxn: any;
  target: string;
  mintime: number;
  curtime: number;
  bits: string;
  height: number;
  difficulty: number;
  sigoplimit: number;
  sizelimit: number;
}

// =====================================================
// Ravencoin RPC Client
// =====================================================

export class RavencoinRPCClient extends BaseRPCClient {
  private lastBlockHeight: number = 0;

  constructor(config: RPCConfig) {
    super(config);
  }

  // =====================================================
  // Connection
  // =====================================================

  async connect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to Ravencoin node at ${this.config.host}:${this.config.port}...`);
      
      const info = await this.getBlockchainInfo();
      
      if (info) {
        this.isConnected = true;
        this.syncStatus = !info.initialblockdownload;
        
        console.log('✅ Connected to Ravencoin node');
        console.log(`   Network: ${info.chain}`);
        console.log(`   Blocks: ${info.blocks}`);
        console.log(`   Difficulty: ${info.difficulty}`);
        console.log(`   Synced: ${this.syncStatus}`);
        
        this.emit('connected');
        this.startSyncMonitor();
        
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ Failed to connect to Ravencoin node:', error.message);
      this.emit('error', error);
      return false;
    }
  }

  // =====================================================
  // Ravencoin Methods
  // =====================================================

  async getBlockchainInfo(): Promise<{
    chain: string;
    blocks: number;
    headers: number;
    difficulty: number;
    initialblockdownload: boolean;
    size_on_disk: number;
  }> {
    return this.sendRequest('getblockchaininfo');
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
      const hashrate = await this.sendRequest<number>('getnetworkhashps', [blocks]);
      return hashrate;
    } catch {
      return 0;
    }
  }

  async getBlockTemplate(miningAddress: string): Promise<BlockTemplate> {
    if (!this.isConnected) {
      throw new Error('Not connected to Ravencoin node');
    }

    try {
      const response: RavencoinBlockTemplate = await this.sendRequest('getblocktemplate', [{
        rules: ['segwit'],
        capabilities: ['coinbasetxn', 'coinbasevalue', 'longpoll', 'workid'],
        mode: 'template'
      }]);

      const template: BlockTemplate = {
        version: response.version,
        previousHash: response.previousblockhash,
        transactions: response.transactions || [],
        coinbaseTxn: response.coinbasetxn || {},
        bits: parseInt(response.bits, 16),
        time: response.curtime,
        height: response.height,
        target: response.target,
        difficulty: response.difficulty,
        sigoplimit: response.sigoplimit,
        sizelimit: response.sizelimit
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

  async submitBlock(blockHex: string): Promise<SubmitResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to Ravencoin node');
    }

    try {
      const result = await this.sendRequest<any>('submitblock', [blockHex]);

      if (result === null) {
        console.log('🎉 Ravencoin block accepted!');
        this.emit('blockAccepted', blockHex);
        return { accepted: true };
      }

      console.log(`⚠️ Block rejected: ${result}`);
      return { accepted: false, message: result };
    } catch (error: any) {
      console.error('Submit block error:', error.message);
      return { accepted: false, message: error.message };
    }
  }

  async getCurrentDifficulty(): Promise<{ difficulty: number; target: string; bits: number }> {
    const chainInfo = await this.getBlockchainInfo();
    const bestBlock = await this.sendRequest<any>('getblockheader', [await this.getBestBlockHash()]);
    
    return {
      difficulty: chainInfo.difficulty,
      target: bestBlock.difficulty,
      bits: parseInt(bestBlock.bits, 16)
    };
  }

  async getBestBlockHash(): Promise<string> {
    return this.sendRequest('getbestblockhash');
  }

  async getBalance(address: string): Promise<{
    available: number;
    pending: number;
    total: number;
  }> {
    try {
      const response = await this.sendRequest<any>('listunspent', [1, 9999999, [address]]);
      
      let total = 0;
      for (const utxo of response || []) {
        total += utxo.amount;
      }
      
      return {
        available: total,
        pending: 0,
        total
      };
    } catch (error) {
      return { available: 0, pending: 0, total: 0 };
    }
  }

  // =====================================================
  // Helpers
  // =====================================================

  private startSyncMonitor(): void {
    setInterval(async () => {
      if (!this.isConnected) return;
      
      try {
        const info = await this.getBlockchainInfo();
        const wasSynced = this.syncStatus;
        this.syncStatus = !info.initialblockdownload;
        
        if (this.syncStatus && !wasSynced) {
          this.emit('synced');
        } else if (!this.syncStatus && wasSynced) {
          this.emit('unsynced');
        }
      } catch (error) {
        this.isConnected = false;
        this.emit('disconnected');
      }
    }, 30000);
  }
}

export default RavencoinRPCClient;
