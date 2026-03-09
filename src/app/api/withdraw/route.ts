import { NextRequest, NextResponse } from 'next/server';
import { 
  requestWithdrawal, 
  getWithdrawalHistory, 
  getAllBalances,
  getWalletBalance 
} from '@/lib/mining-pool-config';

// 📊 GET: الحصول على الأرصدة وسجل السحب
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coin = searchParams.get('coin');
    const action = searchParams.get('action');

    // الحصول على سجل السحب
    if (action === 'history') {
      const history = getWithdrawalHistory(coin || undefined);
      return NextResponse.json({
        success: true,
        history,
        count: history.length
      });
    }

    // الحصول على رصيد عملة معينة
    if (coin) {
      const balance = getWalletBalance(coin.toUpperCase());
      if (!balance) {
        return NextResponse.json(
          { success: false, message: `العملة ${coin} غير مدعومة` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        balance
      });
    }

    // الحصول على جميع الأرصدة
    const balances = getAllBalances();
    return NextResponse.json({
      success: true,
      balances,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error in withdraw API:', error);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}

// 💸 POST: طلب سحب جديد
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coin, amount, destinationAddress } = body;

    // التحقق من البيانات المطلوبة
    if (!coin || !amount || !destinationAddress) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'يرجى تحديد العملة والمبلغ وعنوان الوجهة' 
        },
        { status: 400 }
      );
    }

    // طلب السحب
    const result = requestWithdrawal(
      coin.toUpperCase(), 
      parseFloat(amount), 
      destinationAddress
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        request: result.request,
        newBalance: getWalletBalance(coin.toUpperCase())
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.message
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ أثناء معالجة طلب السحب' },
      { status: 500 }
    );
  }
}
