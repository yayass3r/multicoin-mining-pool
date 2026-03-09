// =====================================================
// إعدادات حوض التعدين متعدد العملات
// Multi-Coin Mining Pool Configuration
// =====================================================

export interface CoinConfig {
  ticker: string;
  name: string;
  algorithm: string;
  stratumPort: number;
  difficulty: number;
  minPayout: number;
  poolFee: number;
  walletAddress: string;
  nodeUrl: string;
  enabled: boolean;
  color: string;
  icon: string;
}

// 🔑 المحافظ الافتراضية
const DEFAULT_WALLETS: Record<string, string> = {
  KAS: "kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86",
  RVN: "REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y",
  ZEPH: "TO_BE_ADDED",
  ALPH: "1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b"
};

// 💼 تخزين المحافظ في الذاكرة (يمكن تحديثها)
let walletStore: Record<string, string> = { ...DEFAULT_WALLETS };

// 📝 الحصول على عنوان المحفظة
export function getWalletAddress(coin: string): string {
  return walletStore[coin] || DEFAULT_WALLETS[coin] || "";
}

// 🔄 تحديث عنوان المحفظة
export function updateWalletAddress(coin: string, newAddress: string): { success: boolean; message: string } {
  const validCoins = ['KAS', 'RVN', 'ALPH'];

  if (!validCoins.includes(coin)) {
    return { success: false, message: `العملة ${coin} غير مدعومة أو معطلة` };
  }

  if (!newAddress || newAddress.trim() === '') {
    return { success: false, message: 'عنوان المحفظة فارغ' };
  }

  // التحقق من صحة العنوان حسب العملة
  const validation = validateWalletAddress(coin, newAddress);
  if (!validation.valid) {
    return { success: false, message: validation.message };
  }

  walletStore[coin] = newAddress.trim();
  return { success: true, message: `تم تحديث محفظة ${coin} بنجاح` };
}

// ✅ التحقق من صحة عنوان المحفظة
function validateWalletAddress(coin: string, address: string): { valid: boolean; message: string } {
  switch (coin) {
    case 'KAS':
      // Kaspa addresses start with "kaspa:"
      if (!address.startsWith('kaspa:')) {
        return { valid: false, message: 'عنوان KAS يجب أن يبدأ بـ kaspa:' };
      }
      if (address.length < 60) {
        return { valid: false, message: 'عنوان KAS قصير جداً' };
      }
      break;

    case 'RVN':
      // Ravencoin addresses start with R
      if (!address.startsWith('R')) {
        return { valid: false, message: 'عنوان RVN يجب أن يبدأ بـ R' };
      }
      if (address.length < 30 || address.length > 40) {
        return { valid: false, message: 'طول عنوان RVN غير صحيح' };
      }
      break;

    case 'ALPH':
      // Alephium addresses are base58, typically 40+ chars
      if (address.length < 40) {
        return { valid: false, message: 'عنوان ALPH قصير جداً' };
      }
      break;
  }

  return { valid: true, message: 'عنوان صحيح' };
}

// 📋 الحصول على جميع المحافظ
export function getAllWallets(): Record<string, string> {
  return { ...walletStore };
}

// 🔄 إعادة تعيين محفظة إلى الوضع الافتراضي
export function resetWallet(coin: string): { success: boolean; message: string } {
  if (DEFAULT_WALLETS[coin]) {
    walletStore[coin] = DEFAULT_WALLETS[coin];
    return { success: true, message: `تم إعادة تعيين محفظة ${coin}` };
  }
  return { success: false, message: 'محفظة غير موجودة' };
}

export const COIN_CONFIGS: Record<string, CoinConfig> = {
  KAS: {
    ticker: "KAS",
    name: "Kaspa",
    algorithm: "kHeavyHash",
    stratumPort: 3333,
    difficulty: 16384,
    minPayout: 100,
    poolFee: 1.0,
    walletAddress: getWalletAddress("KAS"),
    nodeUrl: "127.0.0.1:16110",
    enabled: true,
    color: "#00D4AA",
    icon: "kaspa.svg"
  },
  RVN: {
    ticker: "RVN",
    name: "Ravencoin",
    algorithm: "KawPoW",
    stratumPort: 3334,
    difficulty: 0.5,
    minPayout: 10,
    poolFee: 1.0,
    walletAddress: getWalletAddress("RVN"),
    nodeUrl: "127.0.0.1:8766",
    enabled: true,
    color: "#B456BE",
    icon: "ravencoin.svg"
  },
  ZEPH: {
    ticker: "ZEPH",
    name: "Zephyr Protocol",
    algorithm: "RandomX",
    stratumPort: 3335,
    difficulty: 50000,
    minPayout: 0.1,
    poolFee: 1.0,
    walletAddress: "TO_BE_ADDED",
    nodeUrl: "127.0.0.1:18081",
    enabled: false,  // ⛔ تم إيقاف التعدين
    color: "#1E88E5",
    icon: "zephyr.svg"
  },
  ALPH: {
    ticker: "ALPH",
    name: "Alephium",
    algorithm: "Blake3",
    stratumPort: 3336,
    difficulty: 1000,
    minPayout: 1,
    poolFee: 1.0,
    walletAddress: getWalletAddress("ALPH"),
    nodeUrl: "127.0.0.1:12973",
    enabled: true,
    color: "#FF6B35",
    icon: "alephium.svg"
  }
};

// إعدادات عامة للحوض
export const POOL_CONFIG = {
  poolName: "MultiCoin Mining Pool",
  poolVersion: "1.0.0",
  website: "https://your-pool-domain.com",
  apiPort: 8080,
  adminPort: 8081,
  redisHost: "127.0.0.1",
  redisPort: 6379,
  databaseUrl: "postgresql://user:password@localhost:5432/mining_pool",
  blockRefreshInterval: 500,
  statsUpdateInterval: 10000,
  paymentInterval: 3600000, // كل ساعة
  minConfirmations: {
    KAS: 10,
    RVN: 60,
    ZEPH: 10,
    ALPH: 5
  }
};

// رسائل النظام
export const SYSTEM_MESSAGES = {
  ar: {
    welcome: "مرحباً بك في حوض التعدين متعدد العملات",
    stratumConnected: "متصل بخادم Stratum",
    miningStarted: "بدء التعدين",
    shareAccepted: "تم قبول الشير",
    shareRejected: "تم رفض الشير",
    blockFound: "تم اكتشاف كتلة جديدة!",
    paymentSent: "تم إرسال الدفعة"
  },
  en: {
    welcome: "Welcome to MultiCoin Mining Pool",
    stratumConnected: "Connected to Stratum server",
    miningStarted: "Mining started",
    shareAccepted: "Share accepted",
    shareRejected: "Share rejected",
    blockFound: "New block found!",
    paymentSent: "Payment sent"
  }
};

// =====================================================
// 💰 نظام الأرباح والسحب
// =====================================================

export interface WalletBalance {
  coin: string;
  totalMined: number;       // إجمالي ما تم تعدينه
  pendingPayout: number;    // بانتظار السحب
  totalPaidOut: number;     // تم سحبه
  minPayout: number;        // الحد الأدنى للسحب
  lastPayoutTime: string | null;
  lastPayoutAmount: number;
}

export interface WithdrawalRequest {
  id: string;
  coin: string;
  amount: number;
  walletAddress: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestTime: string;
  txHash?: string;
}

// 💼 أرصدة المحافظ (تخزين مؤقت)
let walletBalances: Record<string, WalletBalance> = {
  KAS: {
    coin: 'KAS',
    totalMined: 2.48,
    pendingPayout: 2.48,
    totalPaidOut: 0,
    minPayout: 1.0,
    lastPayoutTime: null,
    lastPayoutAmount: 0
  },
  RVN: {
    coin: 'RVN',
    totalMined: 3125.00,
    pendingPayout: 125.00,
    totalPaidOut: 3000.00,
    minPayout: 10.0,
    lastPayoutTime: '2024-03-08 12:00',
    lastPayoutAmount: 1000.00
  },
  ALPH: {
    coin: 'ALPH',
    totalMined: 3.75,
    pendingPayout: 0.15,
    totalPaidOut: 3.60,
    minPayout: 0.5,
    lastPayoutTime: '2024-03-08 10:00',
    lastPayoutAmount: 1.80
  }
};

// 📋 سجل عمليات السحب
let withdrawalHistory: WithdrawalRequest[] = [];

// 📊 الحصول على رصيد محفظة
export function getWalletBalance(coin: string): WalletBalance | null {
  return walletBalances[coin] || null;
}

// 📊 الحصول على جميع الأرصدة
export function getAllBalances(): Record<string, WalletBalance> {
  return { ...walletBalances };
}

// 💸 طلب سحب
export function requestWithdrawal(
  coin: string,
  amount: number,
  destinationAddress: string
): { success: boolean; message: string; request?: WithdrawalRequest } {
  
  const balance = walletBalances[coin];
  
  if (!balance) {
    return { success: false, message: `العملة ${coin} غير مدعومة` };
  }

  if (amount <= 0) {
    return { success: false, message: 'المبلغ يجب أن يكون أكبر من صفر' };
  }

  if (amount > balance.pendingPayout) {
    return { success: false, message: `الرصيد غير كافٍ. المتاح: ${balance.pendingPayout} ${coin}` };
  }

  if (amount < balance.minPayout) {
    return { success: false, message: `الحد الأدنى للسحب: ${balance.minPayout} ${coin}` };
  }

  // التحقق من صحة العنوان
  const validation = validateWalletAddress(coin, destinationAddress);
  if (!validation.valid) {
    return { success: false, message: validation.message };
  }

  // إنشاء طلب السحب
  const withdrawalId = `WD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  const withdrawal: WithdrawalRequest = {
    id: withdrawalId,
    coin,
    amount,
    walletAddress: destinationAddress,
    status: 'pending',
    requestTime: new Date().toISOString()
  };

  // إضافة للسجل
  withdrawalHistory.unshift(withdrawal);

  // تحديث الرصيد
  balance.pendingPayout -= amount;
  balance.totalPaidOut += amount;
  balance.lastPayoutTime = new Date().toLocaleString('ar-EG');
  balance.lastPayoutAmount = amount;

  // محاكاة معالجة السحب (في الإنتاج سيتصل بالـ node)
  setTimeout(() => {
    const wd = withdrawalHistory.find(w => w.id === withdrawalId);
    if (wd) {
      wd.status = 'completed';
      wd.txHash = `${coin.toLowerCase()}:tx_${Math.random().toString(36).substr(2, 64)}`;
    }
  }, 3000);

  return {
    success: true,
    message: `تم إنشاء طلب السحب بنجاح! المعرف: ${withdrawalId}`,
    request: withdrawal
  };
}

// 📋 الحصول على سجل السحب
export function getWithdrawalHistory(coin?: string): WithdrawalRequest[] {
  if (coin) {
    return withdrawalHistory.filter(w => w.coin === coin);
  }
  return [...withdrawalHistory];
}

// 📊 تحديث الرصيد (للتعدين الجديد)
export function updateMiningReward(coin: string, amount: number): void {
  if (walletBalances[coin]) {
    walletBalances[coin].totalMined += amount;
    walletBalances[coin].pendingPayout += amount;
  }
}
