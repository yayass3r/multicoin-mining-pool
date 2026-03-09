/**
 * =====================================================
 * 🚀 Kaspa Mining Pool - نقطة الدخول الرئيسية
 * =====================================================
 * 
 * هذا الملف يبدأ تشغيل حوض التعدين الحقيقي
 * 
 * @author Senior Blockchain Protocol Engineer
 * @version 2.0.0 - Production Ready
 */

import { KaspaRPCClient } from './kaspa-rpc/kaspa-client';
import { KHeavyHash } from './heavyhash/kheavyhash';
import { ShareValidator } from './validators/share-validator';
import { KaspaStratumServer } from './stratum/kaspa-stratum-server';

// =====================================================
// الإعدادات
// =====================================================

const CONFIG = {
    // Kaspa Node
    kaspaRpcHost: process.env.KASPA_RPC_HOST || '127.0.0.1',
    kaspaRpcPort: parseInt(process.env.KASPA_RPC_PORT || '16110'),

    // Stratum Server
    stratumPort: parseInt(process.env.STRATUM_PORT || '3333'),

    // التعدين
    miningAddress: process.env.MINING_ADDRESS || 
        'kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86',

    // الصعوبة
    poolDifficulty: parseInt(process.env.POOL_DIFFICULTY || '1000'),
    networkDifficulty: parseInt(process.env.NETWORK_DIFFICULTY || '1000000000'),

    // Pool Info
    poolName: process.env.POOL_NAME || 'MultiCoin Mining Pool',
    poolFee: parseFloat(process.env.POOL_FEE || '1.0'),
};

// =====================================================
// المتغيرات العامة
// =====================================================

let kaspaClient: KaspaRPCClient;
let stratumServer: KaspaStratumServer;
let shareValidator: ShareValidator;

// =====================================================
// 🚀 دالة البدء الرئيسية
// =====================================================

async function main(): Promise<void> {
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('⛏️  Kaspa Mining Pool - Real Implementation');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('');

    try {
        // 1️⃣ الاتصال بـ Kaspa Node
        console.log('🔗 الخطوة 1: الاتصال بـ Kaspa Node...');
        console.log(`   📍 RPC Address: ${CONFIG.kaspaRpcHost}:${CONFIG.kaspaRpcPort}`);

        kaspaClient = new KaspaRPCClient(`${CONFIG.kaspaRpcHost}:${CONFIG.kaspaRpcPort}`);
        
        const connected = await kaspaClient.initialize();
        
        if (!connected) {
            throw new Error('فشل الاتصال بـ Kaspa Node');
        }

        console.log('✅ تم الاتصال بنجاح!');
        console.log('');

        // 2️⃣ التحقق من المزامنة
        console.log('🔗 الخطوة 2: التحقق من المزامنة...');
        
        const networkInfo = await kaspaClient.getNetworkInfo();
        console.log(`   🌐 الشبكة: ${networkInfo.networkName}`);
        console.log(`   📊 الاتصالات: ${networkInfo.connections}`);
        console.log(`   🔄 متزامن: ${networkInfo.isSynced ? 'نعم ✅' : 'جاري... ⏳'}`);

        if (!networkInfo.isSynced) {
            console.log('⚠️ العقدة لم تكتمل مزامنتها بعد');
            console.log('⏳ انتظار المزامنة...');
            
            // انتظار المزامنة
            await new Promise<void>((resolve) => {
                kaspaClient.on('synced', () => {
                    console.log('✅ اكتملت المزامنة!');
                    resolve();
                });
            });
        }

        console.log('');

        // 3️⃣ تهيئة مدقق الشير
        console.log('🔗 الخطوة 3: تهيئة مدقق الشير...');
        
        shareValidator = new ShareValidator(
            CONFIG.poolDifficulty,
            CONFIG.networkDifficulty
        );

        console.log(`   📊 صعوبة الحوض: ${CONFIG.poolDifficulty}`);
        console.log(`   📊 صعوبة الشبكة: ${CONFIG.networkDifficulty}`);
        console.log('✅ تم تهيئة المدقق!');
        console.log('');

        // 4️⃣ جلب أول قالب كتلة
        console.log('🔗 الخطوة 4: جلب قالب الكتلة...');
        
        const blockTemplate = await kaspaClient.getBlockTemplate(CONFIG.miningAddress);
        
        console.log(`   📦 الوقت: ${new Date(blockTemplate.header.timestamp * 1000).toISOString()}`);
        console.log(`   🔢 Bits: 0x${blockTemplate.header.bits.toString(16)}`);
        console.log('✅ تم جلب القالب!');
        console.log('');

        // 5️⃣ بدء Stratum Server
        console.log('🔗 الخطوة 5: بدء Stratum Server...');
        console.log(`   📡 المنفذ: ${CONFIG.stratumPort}`);
        console.log(`   💼 محفظة التعدين: ${CONFIG.miningAddress}`);

        stratumServer = new KaspaStratumServer(
            CONFIG.stratumPort,
            CONFIG.miningAddress,
            kaspaClient
        );

        // مراقبة الأحداث
        stratumServer.on('blockFound', async (result: any) => {
            console.log('');
            console.log('══════════════════════════════════════════════════════════════');
            console.log('🎉🎉🎉 كتلة جديدة اكتُشفت! 🎉🎉🎉');
            console.log('══════════════════════════════════════════════════════════════');
            console.log(`🔗 Hash: ${result.blockHash}`);
            console.log(`💰 المكافأة: ${result.reward} KAS`);
            console.log('══════════════════════════════════════════════════════════════');
            console.log('');
        });

        stratumServer.on('shareValid', (data: any) => {
            console.log(`✅ شير صالح من ${data.client} - صعوبة: ${data.difficulty.toFixed(2)}`);
        });

        stratumServer.on('shareInvalid', (data: any) => {
            console.log(`❌ شير غير صالح من ${data.client}: ${data.error}`);
        });

        await stratumServer.start();
        console.log('✅ Stratum Server يعمل!');
        console.log('');

        // 6️⃣ عرض المعلومات النهائية
        console.log('══════════════════════════════════════════════════════════════');
        console.log('✅ الحوض جاهز للعمل!');
        console.log('══════════════════════════════════════════════════════════════');
        console.log('');
        console.log('📋 معلومات الاتصال:');
        console.log(`   📡 Stratum: stratum+tcp://your-pool.com:${CONFIG.stratumPort}`);
        console.log(`   💼 المحفظة: ${CONFIG.miningAddress}`);
        console.log(`   📊 صعوبة البداية: ${CONFIG.poolDifficulty}`);
        console.log('');
        console.log('📋 أوامر المعدن (Miner Config):');
        console.log(`   -o stratum+tcp://your-pool.com:${CONFIG.stratumPort}`);
        console.log(`   -u ${CONFIG.miningAddress}`);
        console.log(`   -p x`);
        console.log('');
        console.log('══════════════════════════════════════════════════════════════');
        console.log('⏳ في انتظار اتصال المعدنين...');
        console.log('══════════════════════════════════════════════════════════════');
        console.log('');

        // تحديث الصعوبة دورياً
        setInterval(async () => {
            try {
                const { difficulty } = await kaspaClient.getCurrentDifficulty();
                shareValidator.updateNetworkDifficulty(difficulty);
            } catch (error) {
                console.error('خطأ في تحديث الصعوبة:', error);
            }
        }, 30000);

        // طباعة الإحصائيات دورياً
        setInterval(() => {
            const stats = stratumServer.getStats();
            console.log('');
            console.log('📊 الإحصائيات:');
            console.log(`   👷 المعدنين: ${stats.authorizedClients}`);
            console.log(`   ⛏️ Hashrate: ${(stats.poolHashrate / 1000000).toFixed(2)} MH/s`);
            console.log(`   📊 الصعوبة: ${stats.currentDifficulty}`);
        }, 60000);

    } catch (error: any) {
        console.error('');
        console.error('❌ خطأ فادح:', error.message);
        console.error('');
        process.exit(1);
    }
}

// =====================================================
// معالجة إشارات النظام
// =====================================================

process.on('SIGINT', async () => {
    console.log('');
    console.log('🛑 إيقاف الحوض...');
    
    if (stratumServer) {
        await stratumServer.stop();
    }
    
    if (kaspaClient) {
        kaspaClient.disconnect();
    }
    
    console.log('👋 تم الإيقاف بنجاح');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 تم استلام إشارة الإنهاء...');
    
    if (stratumServer) {
        await stratumServer.stop();
    }
    
    if (kaspaClient) {
        kaspaClient.disconnect();
    }
    
    process.exit(0);
});

// =====================================================
// معالجة الأخطاء غير المعالجة
// =====================================================

process.on('uncaughtException', (error) => {
    console.error('❌ خطأ غير معالج:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ رد مرفوض غير معالج:', reason);
    process.exit(1);
});

// =====================================================
// بدء التشغيل
// =====================================================

main();
