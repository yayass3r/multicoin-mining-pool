/**
 * =====================================================
 * Base RPC Client
 * =====================================================
 * 
 * الفئة الأساسية لجميع عملاء RPC
 * 
 * @author Senior Blockchain Architect
 */

import http from 'http';
import https from 'https';
import EventEmitter from 'events';

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
// Base RPC Client Class
// =====================================================

export abstract class BaseRPCClient extends EventEmitter {
  protected config: Required<RPCConfig>;
  protected requestId: number = 0;
  protected isConnected: boolean = false;
  protected syncStatus: boolean = false;
  protected pollInterval: NodeJS.Timeout | null = null;
  protected currentTemplate: BlockTemplate | null = null;

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
  // Abstract Methods
  // =====================================================

  abstract connect(): Promise<boolean>;
  abstract getBlockTemplate(address: string): Promise<BlockTemplate>;
  abstract submitBlock(block: any): Promise<SubmitResult>;
  abstract getNetworkInfo(): Promise<NetworkInfo>;
  abstract getCurrentDifficulty(): Promise<{ difficulty: number; target: string; bits: number }>;

  // =====================================================
  // HTTP Request
  // =====================================================

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

  // =====================================================
  // Common Methods
  // =====================================================

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

  isNodeSynced(): boolean {
    return this.syncStatus;
  }

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
        
        this.currentTemplate = template;
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
}

export default BaseRPCClient;
