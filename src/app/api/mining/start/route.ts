import { NextRequest, NextResponse } from 'next/server';
import { startMining, startAllMining, schedule24_7Mining, getMiningStats } from '@/lib/mining-engine';

// 🚀 بدء التعدين
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { coin, all } = body;

    if (all) {
      // بدء التعدين لجميع العملات
      startAllMining();
      schedule24_7Mining();
      
      return NextResponse.json({
        success: true,
        message: 'تم بدء التعدين 24/7 لجميع العملات',
        mining: getMiningStats()
      });
    }

    if (coin) {
      const result = startMining(coin.toUpperCase());
      return NextResponse.json({
        success: result.success,
        message: result.message,
        stats: getMiningStats(coin.toUpperCase())
      });
    }

    // افتراضياً: بدء التعدين لجميع العملات
    startAllMining();
    schedule24_7Mining();
    
    return NextResponse.json({
      success: true,
      message: 'تم بدء التعدين 24/7',
      mining: getMiningStats()
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}

// 📊 حالة التعدين
export async function GET() {
  try {
    const stats = getMiningStats();
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: Date.now()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}
