/**
 * =====================================================
 * 🌐 Kaspa RPC Client - الاتصال الحقيقي بالعقدة
 * =====================================================
 * 
 * هذا الملف يتعامل مباشرة مع Kaspa Full Node عبر gRPC
 * للاتصال الحقيقي بالشبكة وجلب قوالب الكتل
 * 
 * @author Senior Blockchain Protocol Engineer
 * @version 2.0.0 - Mainnet Ready
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { EventEmitter } from 'events';

// =====================================================
// الأنواع (Types)
// =====================================================

export interface KaspaBlockTemplate {
    header: {
        version: number;
        parents: string[];
        hashMerkleRoot: string;
        acceptedIdMerkleRoot: string;
        utxoCommitment: string;
        timestamp: number;
        bits: number;
        nonce: number;
        daaScore: bigint;
    };
    coinbaseTx: {
        version: number;
        inputs: Array<{
            previousOutpoint: {
                transactionId: string;
                index: number;
            };
            signatureScript: string;
            sequence: number;
        }>;
        outputs: Array<{
            amount: bigint;
            scriptPublicKey: string;
        }>;
        lockTime: number;
        subnetworkId: string;
        gas: number;
        payload: string;
    };
    transactions: any[];
    selectedParentHashes: string[];
    isSynced: boolean;
}

export interface KaspaBlock {
    header: {
        hash: string;
        version: number;
        parents: string[];
        hashMerkleRoot: string;
        acceptedIdMerkleRoot: string;
        utxoCommitment: string;
        timestamp: number;
        bits: number;
        nonce: number;
        daaScore: bigint;
    };
    transactions: any[];
}

export interface KaspaNetworkInfo {
    version: number;
    protocolVersion: string;
    services: number;
    timeOffset: number;
    connections: number;
    isSynced: boolean;
    networkName: string;
    difficulty: number;
    bits: number;
}

export interface MiningJob {
    jobId: string;
    blockTemplate: KaspaBlockTemplate;
    target: bigint;
    difficulty: number;
    timestamp: number;
    miningAddress: string;
}

// =====================================================
// Kaspa RPC Client
// =====================================================

export class KaspaRPCClient extends EventEmitter {
    private client: any;
    private isConnected: boolean = false;
    private readonly rpcAddress: string;
    private readonly retryInterval: number = 5000;
    private syncStatus: boolean = false;
    
    // تعريف مسار proto files (يجب تحميلها من Kaspa)
    private readonly PROTO_PATH = __dirname + '/protos/rpc.proto';

    constructor(rpcAddress: string = '127.0.0.1:16110') {
        super();
        this.rpcAddress = rpcAddress;
    }

    /**
     * 🚀 تهيئة الاتصال بالعقدة
     */
    async initialize(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                console.log('🔌 جاري الاتصال بـ Kaspa Node...');
                console.log(`📍 العنوان: ${this.rpcAddress}`);

                // تحميل تعريف Proto
                // في الإنتاج، يجب تحميل ملفات proto الفعلية من:
                // https://github.com/kaspanet/kaspad/tree/master/protowire
                
                const packageDefinition = protoLoader.loadSync(
                    this.PROTO_PATH,
                    {
                        keepCase: true,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true
                    }
                );

                const proto = grpc.loadPackageDefinition(packageDefinition);
                
                // إنشاء العميل
                // ملاحظة: Kaspa تستخدم gRPC بدون TLS على localhost
                this.client = new proto.kaspad.RPC(
                    this.rpcAddress,
                    grpc.credentials.createInsecure()
                );

                // اختبار الاتصال
                this.client.GetBlockDagInfo({}, (error: any, response: any) => {
                    if (error) {
                        console.error('❌ فشل الاتصال:', error.message);
                        this.scheduleReconnect();
                        resolve(false);
                        return;
                    }

                    this.isConnected = true;
                    console.log('✅ تم الاتصال بنجاح!');
                    console.log(`📊 الشبكة: ${response.networkName}`);
                    console.log(`🔗 الكتل: ${response.blockCount}`);
                    
                    this.emit('connected');
                    this.startSyncMonitor();
                    resolve(true);
                });

            } catch (error: any) {
                console.error('❌ خطأ في التهيئة:', error.message);
                reject(error);
            }
        });
    }

    /**
     * 📡 مراقبة حالة المزامنة
     */
    private startSyncMonitor(): void {
        setInterval(async () => {
            try {
                const info = await this.getBlockDagInfo();
                this.syncStatus = info.isSynced;
                
                if (this.syncStatus) {
                    this.emit('synced');
                } else {
                    this.emit('syncing', info.syncProgress);
                }
            } catch (error) {
                this.emit('error', error);
            }
        }, 10000);
    }

    /**
     * 🔄 إعادة الاتصال التلقائي
     */
    private scheduleReconnect(): void {
        console.log(`⏳ إعادة المحاولة بعد ${this.retryInterval / 1000} ثواني...`);
        setTimeout(() => {
            this.initialize();
        }, this.retryInterval);
    }

    /**
     * 📦 جلب قالب الكتلة الحقيقي (GetBlockTemplate)
     * هذا هو الجزء الأهم لبدء التعدين
     */
    async getBlockTemplate(miningAddress: string): Promise<KaspaBlockTemplate> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('غير متصل بالعقدة'));
                return;
            }

            const request = {
                // عنوان المحفظة الذي ستستلم المكافأة
                payAddress: miningAddress,
                // حجم الكتلة المطلوب
                extraData: Buffer.from('MultiCoin Mining Pool').toString('hex'),
            };

            console.log('📦 جاري جلب قالب الكتلة...');

            this.client.GetBlockTemplate(request, (error: any, response: any) => {
                if (error) {
                    console.error('❌ خطأ في جلب القالب:', error.message);
                    reject(error);
                    return;
                }

                console.log('✅ تم جلب قالب الكتلة بنجاح!');
                
                const blockTemplate: KaspaBlockTemplate = {
                    header: {
                        version: response.block.header.version,
                        parents: response.block.header.parents || [],
                        hashMerkleRoot: response.block.header.hashMerkleRoot,
                        acceptedIdMerkleRoot: response.block.header.acceptedIdMerkleRoot,
                        utxoCommitment: response.block.header.utxoCommitment,
                        timestamp: response.block.header.timestamp,
                        bits: response.block.header.bits,
                        nonce: response.block.header.nonce || 0,
                        daaScore: BigInt(response.block.header.daaScore || '0'),
                    },
                    coinbaseTx: response.block.transactions[0],
                    transactions: response.block.transactions || [],
                    selectedParentHashes: response.selectedParentHashes || [],
                    isSynced: response.isSynced || true,
                };

                this.emit('newBlock', blockTemplate);
                resolve(blockTemplate);
            });
        });
    }

    /**
     * 💎 إرسال الكتلة المعدنية للشبكة
     */
    async submitBlock(block: KaspaBlock): Promise<{ accepted: boolean; message: string }> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected) {
                reject(new Error('غير متصل بالعقدة'));
                return;
            }

            console.log('📤 إرسال الكتلة المعدنية...');
            console.log(`🔗 Hash: ${block.header.hash}`);

            const request = {
                block: {
                    header: block.header,
                    transactions: block.transactions
                }
            };

            this.client.SubmitBlock(request, (error: any, response: any) => {
                if (error) {
                    console.error('❌ رُفضت الكتلة:', error.message);
                    resolve({ 
                        accepted: false, 
                        message: error.message 
                    });
                    return;
                }

                if (response.rejectReason) {
                    console.log('⚠️ رُفضت الكتلة:', response.rejectReason);
                    resolve({ 
                        accepted: false, 
                        message: response.rejectReason 
                    });
                } else {
                    console.log('🎉 تم قبول الكتلة! مكافأة التعدين وصلت!');
                    this.emit('blockAccepted', block);
                    resolve({ 
                        accepted: true, 
                        message: 'Block accepted!' 
                    });
                }
            });
        });
    }

    /**
     * 📊 جلب معلومات شبكة DAG
     */
    async getBlockDagInfo(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.GetBlockDagInfo({}, (error: any, response: any) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(response);
            });
        });
    }

    /**
     * 🎯 جلب الصعوبة الحالية
     */
    async getCurrentDifficulty(): Promise<{ difficulty: number; target: bigint; bits: number }> {
        return new Promise((resolve, reject) => {
            this.client.GetInfo({}, (error: any, response: any) => {
                if (error) {
                    reject(error);
                    return;
                }

                const bits = response.bits || response.currentBits;
                const target = this.bitsToTarget(bits);
                const difficulty = this.targetToDifficulty(target);

                resolve({
                    difficulty,
                    target,
                    bits
                });
            });
        });
    }

    /**
     * 🔢 تحويل Bits إلى Target
     * Bits هو تنسيق مضغوط للـ Target
     */
    private bitsToTarget(bits: number): bigint {
        // تنسيق Bits: 0xSSXXXXXX
        // SS = size (عدد البايتات)
        // XXXXXX = المعامل
        const size = bits >> 24;
        const mantissa = bits & 0x007fffff;

        // حساب الـ Target الفعلي
        let target: bigint;
        if (size <= 3) {
            target = BigInt(mantissa >> (8 * (3 - size)));
        } else {
            target = BigInt(mantissa) << BigInt(8 * (size - 3));
        }

        // التأكد من أن الـ Target لا يتجاوز الحد الأقصى
        const maxTarget = BigInt('0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        if (target > maxTarget) {
            return maxTarget;
        }

        return target;
    }

    /**
     * 📈 تحويل Target إلى Difficulty
     */
    private targetToDifficulty(target: bigint): number {
        const maxTarget = BigInt('0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        const difficulty = Number(maxTarget) / Number(target);
        return Math.floor(difficulty * 1000000) / 1000000; // تقريب لـ 6 أرقام عشرية
    }

    /**
     * 🌐 جلب معلومات الشبكة
     */
    async getNetworkInfo(): Promise<KaspaNetworkInfo> {
        return new Promise((resolve, reject) => {
            this.client.GetInfo({}, (error: any, response: any) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve({
                    version: response.version,
                    protocolVersion: response.protocolVersion,
                    services: response.services,
                    timeOffset: response.timeOffset,
                    connections: response.connections,
                    isSynced: response.isSynced,
                    networkName: response.networkName || 'kaspa-mainnet',
                    difficulty: response.difficulty,
                    bits: response.bits
                });
            });
        });
    }

    /**
     * 💰 جلب رصيد المحفظة
     */
    async getBalance(address: string): Promise<{ available: bigint; pending: bigint; total: bigint }> {
        return new Promise((resolve, reject) => {
            this.client.GetBalancesByAddresses({ addresses: [address] }, (error: any, response: any) => {
                if (error) {
                    reject(error);
                    return;
                }

                const balance = response.entries?.[0] || {};
                resolve({
                    available: BigInt(balance.available || '0'),
                    pending: BigInt(balance.pending || '0'),
                    total: BigInt(balance.total || '0')
                });
            });
        });
    }

    /**
     * 📡 حالة الاتصال
     */
    getConnectionStatus(): boolean {
        return this.isConnected;
    }

    /**
     * 🔄 حالة المزامنة
     */
    getSyncStatus(): boolean {
        return this.syncStatus;
    }

    /**
     * 🛑 إغلاق الاتصال
     */
    disconnect(): void {
        if (this.client) {
            this.client.close();
            this.isConnected = false;
            console.log('🔌 تم إغلاق الاتصال');
        }
    }
}

// =====================================================
// 💻 مثال على الاستخدام
// =====================================================

/*
async function main() {
    // إنشاء العميل
    const kaspaClient = new KaspaRPCClient('127.0.0.1:16110');
    
    // الاتصال بالعقدة
    await kaspaClient.initialize();
    
    // جلب قالب الكتلة
    const template = await kaspaClient.getBlockTemplate(
        'kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86'
    );
    
    console.log('📦 قالب الكتلة:', template);
    
    // التعدين...
    // بعد العثور على كتلة:
    // await kaspaClient.submitBlock(minedBlock);
}
*/

export default KaspaRPCClient;
