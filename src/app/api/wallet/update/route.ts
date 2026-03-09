import { NextRequest, NextResponse } from 'next/server';
import { updateWalletAddress, getWalletAddress, getAllWallets, resetWallet } from '@/lib/mining-pool-config';

// 📋 GET: الحصول على جميع المحافظ
export async function GET() {
  try {
    const wallets = getAllWallets();
    return NextResponse.json({
      success: true,
      wallets,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return NextResponse.json(
      { success: false, error: 'فشل في جلب المحافظ' },
      { status: 500 }
    );
  }
}

// 🔄 POST: تحديث محفظة
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coin, address, action } = body;

    // إعادة تعيين المحفظة
    if (action === 'reset' && coin) {
      const result = resetWallet(coin);
      return NextResponse.json({
        success: result.success,
        message: result.message,
        wallet: getWalletAddress(coin)
      });
    }

    // تحديث المحفظة
    if (!coin || !address) {
      return NextResponse.json(
        { success: false, message: 'يرجى تحديد العملة والعنوان' },
        { status: 400 }
      );
    }

    const result = updateWalletAddress(coin.toUpperCase(), address);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      coin: coin.toUpperCase(),
      wallet: getWalletAddress(coin.toUpperCase())
    });

  } catch (error) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء تحديث المحفظة' },
      { status: 500 }
    );
  }
}
