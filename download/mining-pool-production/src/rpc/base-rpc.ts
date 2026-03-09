/**
 * =====================================================
 * Base RPC Client - Abstract Class
 * =====================================================
 * 
 * فئة أساسية لجميع عملاء RPC
 * 
 * @author Senior Blockchain Architect
 */

import net from 'net';
import tls from 'tls';
import EventEmitter from 'events';

// Types
export interface RPCConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  timeout?: number;
  ssl?: boolean;
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
  merkleRoot?: string;
  [key: string]: any;
}

export interface SubmitResult {
  accepted: boolean;
  message?: string;
  blockHash?: string;
}

export interface NetworkInfo {
  version: number;
  protocolVersion: number | string;
  connections: number;
  isSynced: boolean;
  networkHashrate: number;
  difficulty: number;
  blockHeight: number;
}

export abstract class BaseRPCClient extends EventEmitter {
  protected config: Required<RPCConfig>;
  protected requestId: number = 0;
  protected isConnected: boolean = false;
  protected reconnectAttempts: number = 0;
  protected maxReconnectAttempts: number = 10;
  protected socket: net.Socket | null = null;
  
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

  /**
   * إنشاء اتصال بالعقدة
   */
  abstract connect(): Promise<boolean>;

  /**
   * جلب قالب الكتلة
   */
  abstract getBlockTemplate(address: string, extraData?: string): Promise<BlockTemplate>;

  /**
   * إرسال كتلة
   */
  abstract submitBlock(block: string | Buffer): Promise<SubmitResult>;

  /**
   * معلومات الشبكة
   */
  abstract getNetworkInfo(): Promise<NetworkInfo>;

  /**
   * جلب رصيد
   */
  abstract getBalance?(address: string): Promise<{ available: bigint; pending: bigint }>;

  /**
   * إرسال طلب JSON-RPC
   */
  protected async sendRequest<T>(method: string, params: any[] = []): Promise<T> {
    this.requestId++;
    const request = {
      jsonrpc: '2.0',
      id: this.requestId,
      method,
      params
    };

    const response = await this.sendRawRequest(JSON.stringify(request));
    const parsed = JSON.parse(response);

    if (parsed.error) {
      throw new Error(`RPC Error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
    }

    return parsed.result;
  }

  /**
   * إرسال طلب HTTP
   */
  protected async sendRawRequest(body: string): Promise<string> {
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
        },
        auth: this.config.user && this.config.password 
          ? `${this.config.user}:${this.config.password}` 
          : undefined
      };

      const protocol = this.config.ssl ? require('https') : require('http');
      
      const req = protocol.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          clearTimeout(timeout);
          if (res.statusCode === 200 || res.statusCode === 500) {
            resolve(data);
          } else {
            reject(new Error(`HTTP Error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * معالجة إعادة الاتصال
   */
  protected async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000);
    
    console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    await this.connect();
  }

  /**
   * قطع الاتصال
   */
  disconnect(): void {
    this.isConnected = false;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.emit('disconnected');
  }

  /**
   * حالة الاتصال
   */
  isNodeConnected(): boolean {
    return this.isConnected;
  }
}
