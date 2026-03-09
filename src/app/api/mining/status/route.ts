import { NextResponse } from 'next/server';
import { 
  getMiningStats, 
  getBlockHistory, 
  getTotalBlocks,
  isMining,
  getAllMiningStatus,
  getMiningConfig
} from '@/lib/mining-engine';
import { getAllBalances } from '@/lib/mining-pool-config';

// 📊 حالة التعدين الكاملة
export async function GET() {
  try {
    const stats = getMiningStats();
    const blocks = getBlockHistory();
    const totalBlocks = getTotalBlocks();
    const status = getAllMiningStatus();
    const config = getMiningConfig();
    const balances = getAllBalances();

    // حساب إحصائيات إضافية
    const uptime = process.uptime();
    const activeMiners = Object.values(status).filter(s => s).length;

    // حساب الأرباح اليومية
    let dailyProfit = 0;
    let totalPending = 0;
    let totalMined = 0;

    for (const [coin, balance] of Object.entries(balances)) {
      totalPending += balance.pendingPayout;
      totalMined += balance.totalMined;
      
      // تقدير الأرباح بالدولار (أسعار تقريبية)
      const prices: Record<string, number> = {
        'KAS': 0.15,
        'RVN': 0.02,
        'ALPH': 0.35
      };
      dailyProfit += (balance.pendingPayout * (prices[coin] || 0));
    }

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      uptime,
      mining: {
        status,
        stats,
        activeMiners,
        totalBlocks,
        recentBlocks: blocks.slice(0, 10)
      },
      balances,
      profit: {
        daily: dailyProfit.toFixed(2),
        totalPending,
        totalMined
      },
      config
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}
