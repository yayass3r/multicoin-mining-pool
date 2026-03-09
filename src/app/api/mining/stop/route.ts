import { NextRequest, NextResponse } from 'next/server';
import { stopMining, stopAllMining } from '@/lib/mining-engine';

// 🛑 إيقاف التعدين
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { coin, all } = body;

    if (all) {
      stopAllMining();
      return NextResponse.json({
        success: true,
        message: 'تم إيقاف جميع عمليات التعدين'
      });
    }

    if (coin) {
      const result = stopMining(coin.toUpperCase());
      return NextResponse.json(result);
    }

    // افتراضياً: إيقاف الكل
    stopAllMining();
    return NextResponse.json({
      success: true,
      message: 'تم إيقاف التعدين'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message
    }, { status: 500 });
  }
}
