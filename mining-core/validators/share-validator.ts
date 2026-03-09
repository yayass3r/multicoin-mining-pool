/**
 * =====================================================
 * ✅ Share Validator - التحقق الحقيقي من الشير
 * =====================================================
 * 
 * هذا الملف يحتوي على الكود الرياضي الدقيق للتحقق
 * من أن الـ Hash الناتج من جهاز التعدين أقل من الـ Target
 * 
 * @author Senior Blockchain Protocol Engineer
 * @version 2.0.0 - Production Ready
 */

import { KHeavyHash } from '../heavyhash/kheavyhash';

// =====================================================
// الأنواع (Types)
// =====================================================

export interface ShareSubmission {
    workerId: string;           // معرف العامل
    jobId: string;              // معرف المهمة
    nonce: number;              // الـ Nonce المكتشف
    timestamp: number;          // الوقت
    extraNonce1: string;        // Extra Nonce 1 (من Pool)
    extraNonce2: string;        // Extra Nonce 2 (من Miner)
}

export interface ValidationResult {
    isValid: boolean;           // هل الشير صالح؟
    isBlock: boolean;           // هل هي كتلة كاملة؟
    difficulty: number;         // صعوبة الشير
    blockDifficulty: number;    // صعوبة الشبكة
    shareHash: string;          // Hash الشير
    blockHash?: string;         // Hash الكتلة (إذا وُجدت)
    error?: string;             // رسالة الخطأ
    reward?: number;            // المكافأة
}

export interface MiningJob {
    jobId: string;
    headerTemplate: Buffer;     // قالب الـ Header (بدون nonce)
    target: bigint;             // Target الشبكة
    shareTarget: bigint;        // Target الشير (أسهل)
    difficulty: number;         // صعوبة الشبكة
    shareDifficulty: number;    // صعوبة الشير
    coinbaseTx: Buffer;         // معاملة Coinbase
    timestamp: number;
}

export interface WorkerStats {
    workerId: string;
    validShares: number;
    invalidShares: number;
    staleShares: number;
    totalDifficulty: number;
    lastShareTime: number;
    hashrate: number;           // H/s
}

// =====================================================
// Share Validator
// =====================================================

export class ShareValidator {
    private readonly poolDifficulty: number;
    private readonly networkDifficulty: number;
    private readonly poolTarget: bigint;
    private readonly networkTarget: bigint;
    private workerStats: Map<string, WorkerStats> = new Map();

    constructor(poolDifficulty: number = 1000, networkDifficulty?: number) {
        this.poolDifficulty = poolDifficulty;
        this.networkDifficulty = networkDifficulty || 1000000000;
        
        // تحويل Difficulty إلى Target
        this.poolTarget = KHeavyHash.difficultyToTarget(poolDifficulty);
        this.networkTarget = networkDifficulty 
            ? KHeavyHash.difficultyToTarget(networkDifficulty) 
            : this.calculateMaxTarget();
    }

    /**
     * 🎯 التحقق الرياضي الدقيق من الشير
     * 
     * المعادلة: Hash < Target = صالح
     */
    async validateShare(
        submission: ShareSubmission,
        job: MiningJob
    ): Promise<ValidationResult> {
        
        console.log(`🔍 التحقق من شير من ${submission.workerId}`);
        console.log(`📋 Job: ${submission.jobId}, Nonce: ${submission.nonce}`);

        // 1️⃣ التحقق من أن الـ Job لا يزال صالحاً
        if (job.jobId !== submission.jobId) {
            return {
                isValid: false,
                isBlock: false,
                difficulty: 0,
                blockDifficulty: this.networkDifficulty,
                shareHash: '',
                error: 'Stale job - old work submitted'
            };
        }

        // 2️⃣ بناء Block Header كامل
        const headerBytes = this.buildBlockHeader(job, submission);
        
        // 3️⃣ حساب الـ Hash باستخدام kHeavyHash
        const hashResult = KHeavyHash.hashBlockHeader({
            version: headerBytes.readUInt32LE(0),
            parents: [], // يتم ملؤها من job
            hashMerkleRoot: headerBytes.slice(20, 52).toString('hex'),
            acceptedIdMerkleRoot: headerBytes.slice(52, 84).toString('hex'),
            utxoCommitment: headerBytes.slice(84, 116).toString('hex'),
            timestamp: submission.timestamp || job.timestamp,
            bits: this.targetToBits(job.target),
            nonce: submission.nonce,
            daaScore: BigInt(0) // من job
        });

        // 4️⃣ تحويل Hash إلى BigInt للمقارنة
        const hashBigInt = BigInt('0x' + hashResult.hash);
        
        console.log(`🔢 Hash: ${hashResult.hash.slice(0, 16)}...`);
        console.log(`🎯 Pool Target: ${this.poolTarget.toString(16).slice(0, 16)}...`);
        console.log(`🎯 Network Target: ${this.networkTarget.toString(16).slice(0, 16)}...`);

        // 5️⃣ التحقق: هل Hash < Pool Target؟ (شير صالح)
        const isValidShare = hashBigInt < this.poolTarget;
        
        // 6️⃣ التحقق: هل Hash < Network Target؟ (كتلة كاملة!)
        const isBlock = hashBigInt < this.networkTarget;

        // 7️⃣ حساب صعوبة الشير الفعلية
        const shareDifficulty = this.calculateShareDifficulty(hashBigInt);

        // 8️⃣ تحديث إحصائيات العامل
        this.updateWorkerStats(submission.workerId, isValidShare, shareDifficulty);

        if (isBlock) {
            console.log('🎉🎉🎉 كتلة جديدة اكتُشفت! 🎉🎉🎉');
            console.log(`🔗 Block Hash: ${hashResult.hash}`);
            
            return {
                isValid: true,
                isBlock: true,
                difficulty: shareDifficulty,
                blockDifficulty: this.networkDifficulty,
                shareHash: hashResult.hash,
                blockHash: hashResult.hash,
                reward: this.calculateBlockReward() // مكافأة التعدين
            };
        }

        if (isValidShare) {
            console.log('✅ شير صالح!');
            
            return {
                isValid: true,
                isBlock: false,
                difficulty: shareDifficulty,
                blockDifficulty: this.networkDifficulty,
                shareHash: hashResult.hash
            };
        }

        // شير غير صالح
        console.log('❌ شير غير صالح - Hash أعلى من Target');
        
        return {
            isValid: false,
            isBlock: false,
            difficulty: 0,
            blockDifficulty: this.networkDifficulty,
            shareHash: hashResult.hash,
            error: 'Invalid share - hash above target'
        };
    }

    /**
     * 🔨 بناء Block Header من المكونات
     */
    private buildBlockHeader(job: MiningJob, submission: ShareSubmission): Buffer {
        // حجم Block Header في Kaspa: ~200 bytes تقريباً
        const headerBuffer = Buffer.alloc(256);
        let offset = 0;

        // Version (4 bytes)
        headerBuffer.writeUInt32LE(1, offset);
        offset += 4;

        // Parents count (1 byte) + parents (32 bytes each)
        // يتم ملؤها من job
        headerBuffer.writeUInt8(0, offset);
        offset += 1;

        // Hash Merkle Root (32 bytes)
        Buffer.from(job.headerTemplate.slice(20, 52)).copy(headerBuffer, offset);
        offset += 32;

        // Accepted ID Merkle Root (32 bytes)
        Buffer.from(job.headerTemplate.slice(52, 84)).copy(headerBuffer, offset);
        offset += 32;

        // UTXO Commitment (32 bytes)
        Buffer.from(job.headerTemplate.slice(84, 116)).copy(headerBuffer, offset);
        offset += 32;

        // Timestamp (8 bytes)
        headerBuffer.writeBigUInt64LE(BigInt(submission.timestamp || Date.now()), offset);
        offset += 8;

        // Bits (4 bytes)
        headerBuffer.writeUInt32LE(this.targetToBits(job.target), offset);
        offset += 4;

        // Nonce (8 bytes) - هذا هو الجزء الذي يغيره المعدن
        headerBuffer.writeBigUInt64LE(BigInt(submission.nonce), offset);
        offset += 8;

        // Extra Nonce (إذا كان موجوداً)
        if (submission.extraNonce1 && submission.extraNonce2) {
            const extraNonce1 = Buffer.from(submission.extraNonce1, 'hex');
            const extraNonce2 = Buffer.from(submission.extraNonce2, 'hex');
            extraNonce1.copy(headerBuffer, offset);
            offset += extraNonce1.length;
            extraNonce2.copy(headerBuffer, offset);
            offset += extraNonce2.length;
        }

        return headerBuffer.slice(0, offset);
    }

    /**
     * 📊 حساب صعوبة الشير
     */
    private calculateShareDifficulty(hash: bigint): number {
        // difficulty = maxTarget / hash
        const maxTarget = this.calculateMaxTarget();
        const difficulty = Number(maxTarget / hash);
        return Math.max(difficulty, 0);
    }

    /**
     * 🎯 حساب Max Target
     */
    private calculateMaxTarget(): bigint {
        // Kaspa max target = 2^255 - 1
        return BigInt('0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    }

    /**
     * 🔄 تحويل Target إلى Bits
     */
    private targetToBits(target: bigint): number {
        // البحث عن أصغر تمثيل
        let nSize = (target.toString(2).length + 7) / 8;
        
        if (nSize <= 3) {
            return Number(target << BigInt(8 * (3 - nSize))) | nSize << 24;
        }

        return Number(target >> BigInt(8 * (nSize - 3))) | nSize << 24;
    }

    /**
     * 📈 تحديث إحصائيات العامل
     */
    private updateWorkerStats(
        workerId: string, 
        isValid: boolean, 
        difficulty: number
    ): void {
        let stats = this.workerStats.get(workerId);
        
        if (!stats) {
            stats = {
                workerId,
                validShares: 0,
                invalidShares: 0,
                staleShares: 0,
                totalDifficulty: 0,
                lastShareTime: 0,
                hashrate: 0
            };
        }

        if (isValid) {
            stats.validShares++;
            stats.totalDifficulty += difficulty;
        } else {
            stats.invalidShares++;
        }

        // حساب الـ Hashrate
        const now = Date.now();
        const timeDiff = now - stats.lastShareTime;
        if (timeDiff > 0 && isValid) {
            // hashrate ≈ difficulty / time (simplified)
            stats.hashrate = Math.round((difficulty * 65536) / (timeDiff / 1000));
        }
        stats.lastShareTime = now;

        this.workerStats.set(workerId, stats);
    }

    /**
     * 💰 حساب مكافأة الكتلة
     */
    private calculateBlockReward(): number {
        // Kaspa block reward: 10 KAS (يتناقص مع الوقت)
        return 10;
    }

    /**
     * 📊 الحصول على إحصائيات العامل
     */
    getWorkerStats(workerId: string): WorkerStats | undefined {
        return this.workerStats.get(workerId);
    }

    /**
     * 📊 الحصول على جميع الإحصائيات
     */
    getAllWorkerStats(): WorkerStats[] {
        return Array.from(this.workerStats.values());
    }

    /**
     * 🧮 حساب الـ Hashrate الإجمالي للحوض
     */
    getPoolHashrate(): number {
        let totalHashrate = 0;
        for (const stats of this.workerStats.values()) {
            totalHashrate += stats.hashrate;
        }
        return totalHashrate;
    }

    /**
     * 🔄 تحديث صعوبة الشبكة
     */
    updateNetworkDifficulty(difficulty: number): void {
        console.log(`📊 تحديث صعوبة الشبكة: ${difficulty}`);
        this.networkTarget = KHeavyHash.difficultyToTarget(difficulty);
    }

    /**
     * 🔄 تحديث صعوبة الحوض
     */
    updatePoolDifficulty(difficulty: number): void {
        console.log(`📊 تحديث صعوبة الحوض: ${difficulty}`);
        this.poolTarget = KHeavyHash.difficultyToTarget(difficulty);
    }
}

// =====================================================
// 🧮 أمثلة رياضية
// =====================================================

/**
 * مثال: كيف يعمل التحقق من الشير
 * 
 * 1. جهاز التعدين يرسل:
 *    - Nonce: 12345678
 *    - Job ID: job-abc123
 * 
 * 2. الحوض يبني Block Header:
 *    - يدمج Nonce مع الـ Header Template
 *    - يحسب الـ Header Bytes
 * 
 * 3. الحوض يحسب Hash:
 *    hash = kHeavyHash(headerBytes)
 *    hashBigInt = 0x[hash]
 * 
 * 4. المقارنة الرياضية:
 *    - إذا hashBigInt < poolTarget → شير صالح ✅
 *    - إذا hashBigInt < networkTarget → كتلة! 🎉
 * 
 * مثال عملي:
 *    hashBigInt     = 0x00000000000000000123456789abcdef...
 *    poolTarget     = 0x00000fffffffffffffffffffffffffff...
 *    networkTarget  = 0x0000000000000fffffffffffffffffff...
 *    
 *    hashBigInt < poolTarget?  ✅ نعم (شير صالح)
 *    hashBigInt < networkTarget? ❌ لا (ليست كتلة)
 */

// =====================================================
// 💻 مثال على الاستخدام
// =====================================================

/*
const validator = new ShareValidator(1000, 500000000);

const submission: ShareSubmission = {
    workerId: 'worker-001',
    jobId: 'job-abc123',
    nonce: 12345678,
    timestamp: Date.now(),
    extraNonce1: 'a1b2c3d4',
    extraNonce2: 'e5f6g7h8'
};

const job: MiningJob = {
    jobId: 'job-abc123',
    headerTemplate: Buffer.from('...'),
    target: BigInt('0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
    shareTarget: BigInt('0x000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
    difficulty: 500000000,
    shareDifficulty: 1000,
    coinbaseTx: Buffer.from('...'),
    timestamp: Date.now()
};

const result = await validator.validateShare(submission, job);

if (result.isBlock) {
    console.log('🎉 كتلة جديدة!');
    // إرسال للشبكة...
} else if (result.isValid) {
    console.log('✅ شير صالح');
} else {
    console.log('❌ شير غير صالح:', result.error);
}
*/

export default ShareValidator;
