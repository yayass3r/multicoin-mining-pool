/**
 * =====================================================
 * Kaspa RPC Client - الإنتاج الحقيقي
 * =====================================================
 * 
 * عميل RPC حقيقي لشبكة Kaspa
 * يتصل بعقدة Kaspa للحصول على قوالب الكتل والإحصائيات
 * 
 * @author Senior Blockchain Architect
 */

import { BaseRPCClient, BlockTemplate, SubmitResult, NetworkInfo, RPCConfig } from './base-rpc';
import EventEmitter from 'events';

// =====================================================
// Kaspa Types
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

// =====================================================
// Kaspa RPC Client
// =====================================================

export class KaspaRPCClient extends BaseRPCClient {
  private lastBlockHeight: number = 0;

  constructor(config: RPCConfig) {
    super(config);
  }

  // =====================================================
  // Connection
  // =====================================================

  async connect(): Promise<boolean> {
    try {
      console.log(`🔌 Connecting to Kaspa node at ${this.config.host}:${this.config.port}...`);
      
      const info = await this.getInfo();
      
      if (info) {
        this.isConnected = true;
        this.syncStatus = info.isSynced;
        
        console.log('✅ Connected to Kaspa node');
        console.log(`   Network: ${info.networkName || 'mainnet'}`);
        console.log(`   Version: ${info.version}`);
        console.log(`   Synced: ${info.isSynced}`);
        
        this.emit('connected');
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

  // =====================================================
  // Kaspa Methods
  // =====================================================

  async getInfo(): Promise<any> {
    try {
      return await this.sendRequest('getInfo');
    } catch (error) {
      throw error;
    }
  }

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

  async getBlockTemplate(miningAddress: string): Promise<BlockTemplate> {
    if (!this.isConnected) {
      throw new Error('Not connected to Kaspa node');
    }

    try {
      const response = await this.sendRequest<any>('getBlockTemplate', {
        payAddress: miningAddress,
        extraData: Buffer.from('MultiCoin Mining Pool').toString('hex')
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

      this.currentTemplate = template;
      return template;
    } catch (error: any) {
      console.error('Failed to get block template:', error.message);
      throw error;
    }
  }

  async submitBlock(block: KaspaBlock): Promise<SubmitResult> {
    if (!this.isConnected) {
      throw new Error('Not connected to Kaspa node');
    }

    try {
      const response = await this.sendRequest<any>('submitBlock', {
        block: block
      });

      if (response.rejectReason) {
        console.log(`⚠️ Block rejected: ${response.rejectReason}`);
        return {
          accepted: false,
          message: response.rejectReason
        };
      }

      console.log('🎉 Kaspa block accepted!');
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

  async getCurrentDifficulty(): Promise<{ difficulty: number; target: string; bits: number }> {
    const dagInfo = await this.getBlockDagInfo();
    const info = await this.getInfo();
    
    return {
      difficulty: dagInfo.difficulty || info.difficulty || 1,
      target: this.bitsToTarget(info.bits || 0x1b0404cb),
      bits: info.bits || 0x1b0404cb
    };
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
    } catch (error) {
      return { available: BigInt(0), pending: BigInt(0), total: BigInt(0) };
    }
  }

  // =====================================================
  // Helpers
  // =====================================================

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
    if (target > maxTarget) {
      target = maxTarget;
    }
    
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
        this.isConnected = false;
        this.emit('disconnected');
      }
    }, 30000);
  }
}

export default KaspaRPCClient;
