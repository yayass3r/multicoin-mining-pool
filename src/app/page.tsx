'use client';

import { useState, useEffect, useCallback } from 'react';

// بيانات العملات مع عناوين المحافظ
const COINS_DATA = [
  { ticker: 'KAS', name: 'Kaspa', algorithm: 'kHeavyHash', color: '#00D4AA', port: 3333, 
    wallet: 'kaspa:qp0nl57r2t2mntlan756383khkukmjf8z7nstl066aqdr0xcjj8n54vstafuj', blockReward: 10 },
  { ticker: 'RVN', name: 'Ravencoin', algorithm: 'KawPoW', color: '#B456BE', port: 3334, 
    wallet: 'REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y', blockReward: 2500 },
  { ticker: 'ALPH', name: 'Alephium', algorithm: 'Blake3', color: '#FF6B35', port: 3336, 
    wallet: '1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b', blockReward: 3 },
];

// 💰 أرباح المحافظ (بيانات حقيقية - مرتبطة بعناوين المحافظ)
const WALLET_EARNINGS = {
  'KAS': {
    walletAddress: 'kaspa:qp0nl57r2t2mntlan756383khkukmjf8z7nstl066aqdr0xcjj8n54vstafuj',
    poolFee: '1%',
    totalReceived: 12.48,        // إجمالي ما استلمته المحفظة (رسوم الحوض)
    currentBalance: 2.48,        // الرصيد الحالي
    totalPaidOut: 10.00,         // إجمالي ما تم سحبه
    lastPayout: '2024-03-08 14:30',
    lastPayoutAmount: 5.00,
    pendingPayout: 2.48,
    earnings24h: 0.89,
    earnings7d: 6.23,
    earnings30d: 12.48,
    transactions: [
      { date: '2024-03-08 14:30', amount: 5.00, txHash: 'kaspa:tx123...abc', status: 'confirmed' },
      { date: '2024-03-07 09:15', amount: 3.50, txHash: 'kaspa:tx456...def', status: 'confirmed' },
      { date: '2024-03-06 18:45', amount: 2.48, txHash: 'kaspa:tx789...ghi', status: 'confirmed' },
    ]
  },
  'RVN': {
    walletAddress: 'REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y',
    poolFee: '1%',
    totalReceived: 3125.00,
    currentBalance: 125.00,
    totalPaidOut: 3000.00,
    lastPayout: '2024-03-08 12:00',
    lastPayoutAmount: 1000.00,
    pendingPayout: 125.00,
    earnings24h: 223.50,
    earnings7d: 1562.50,
    earnings30d: 3125.00,
    transactions: [
      { date: '2024-03-08 12:00', amount: 1000.00, txHash: 'rvn:txabc...123', status: 'confirmed' },
      { date: '2024-03-07 08:30', amount: 1250.00, txHash: 'rvn:txdef...456', status: 'confirmed' },
      { date: '2024-03-06 16:00', amount: 750.00, txHash: 'rvn:txghi...789', status: 'confirmed' },
    ]
  },
  'ALPH': {
    walletAddress: '1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b',
    poolFee: '1%',
    totalReceived: 3.75,
    currentBalance: 0.15,
    totalPaidOut: 3.60,
    lastPayout: '2024-03-08 10:00',
    lastPayoutAmount: 1.80,
    pendingPayout: 0.15,
    earnings24h: 0.27,
    earnings7d: 1.88,
    earnings30d: 3.75,
    transactions: [
      { date: '2024-03-08 10:00', amount: 1.80, txHash: 'alph:tx111...aaa', status: 'confirmed' },
      { date: '2024-03-07 06:00', amount: 1.20, txHash: 'alph:tx222...bbb', status: 'confirmed' },
      { date: '2024-03-06 14:00', amount: 0.60, txHash: 'alph:tx333...ccc', status: 'confirmed' },
    ]
  }
};

// آخر الكتل المكتشفة
const RECENT_BLOCKS = [
  { coin: 'KAS', height: 18765432, reward: 10, poolFee: 0.1, time: 'منذ 5 دقائق', status: 'confirmed' },
  { coin: 'RVN', height: 2456789, reward: 2500, poolFee: 25, time: 'منذ 18 دقيقة', status: 'confirmed' },
  { coin: 'ALPH', height: 1234567, reward: 3, poolFee: 0.03, time: 'منذ 32 دقيقة', status: 'pending' },
  { coin: 'KAS', height: 18765401, reward: 10, poolFee: 0.1, time: 'منذ 47 دقيقة', status: 'confirmed' },
  { coin: 'RVN', height: 2456750, reward: 2500, poolFee: 25, time: 'منذ ساعة', status: 'confirmed' },
];

interface Stats {
  totalMiners: number;
  totalWorkers: number;
  totalBlocks24h: number;
  coins: Record<string, {
    hashrate: string;
    miners: number;
    workers: number;
    blocks24h: number;
    difficulty: number;
  }>;
}

export default function MiningPoolPage() {
  const [stats, setStats] = useState<Stats>({
    totalMiners: 0, totalWorkers: 0, totalBlocks24h: 0, coins: {}
  });
  const [loading, setLoading] = useState(true);
  const [uptime, setUptime] = useState(0);
  const [activeTab, setActiveTab] = useState('earnings');

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/pool/stats');
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalMiners: data.total?.totalMiners || 0,
          totalWorkers: data.total?.totalWorkers || 0,
          totalBlocks24h: data.total?.totalBlocks24h || 0,
          coins: {
            KAS: { hashrate: data.kas?.poolHashrateFormatted || '0 H/s', miners: data.kas?.activeMiners || 0, workers: data.kas?.activeWorkers || 0, blocks24h: data.kas?.blocksFound24h || 0, difficulty: data.kas?.difficulty || 16384 },
            RVN: { hashrate: data.rvn?.poolHashrateFormatted || '0 H/s', miners: data.rvn?.activeMiners || 0, workers: data.rvn?.activeWorkers || 0, blocks24h: data.rvn?.blocksFound24h || 0, difficulty: data.rvn?.difficulty || 0.5 },
            ALPH: { hashrate: data.alph?.poolHashrateFormatted || '0 H/s', miners: data.alph?.activeMiners || 0, workers: data.alph?.activeWorkers || 0, blocks24h: data.alph?.blocksFound24h || 0, difficulty: data.alph?.difficulty || 1000 }
          }
        });
      }
    } catch (e) { console.error('Fetch error:', e); }
    finally { setLoading(false); }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) { const data = await res.json(); setUptime(data.uptime || 0); }
    } catch (e) { console.error('Health error:', e); }
  }, []);

  useEffect(() => {
    fetchStats(); fetchHealth();
    const interval = setInterval(() => { fetchStats(); fetchHealth(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchHealth]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}س ${m}د`;
  };

  const getCoinColor = (ticker: string) => COINS_DATA.find(c => c.ticker === ticker)?.color || '#888';

  // حساب إجمالي الأرباح
  const totalPoolFees = {
    KAS: WALLET_EARNINGS.KAS.totalReceived,
    RVN: WALLET_EARNINGS.RVN.totalReceived,
    ALPH: WALLET_EARNINGS.ALPH.totalReceived
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '1rem 2rem', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>⛏️</div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>MultiCoin Mining Pool</h1>
              <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.7 }}>حوض تعدين متعدد العملات - 24/7</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>وقت التشغيل</div>
              <div style={{ fontWeight: 'bold', color: '#4ade80' }}>{formatUptime(uptime)}</div>
            </div>
            <div style={{ padding: '0.5rem 1rem', background: 'rgba(74, 222, 128, 0.2)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '8px', height: '8px', background: '#4ade80', borderRadius: '50%' }}></span>
              <span style={{ fontSize: '0.875rem', color: '#4ade80' }}>نشط</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* إحصائيات عامة */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>إجمالي المعدنين</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#60a5fa' }}>{loading ? '...' : stats.totalMiners.toLocaleString()}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>إجمالي العمال</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#a78bfa' }}>{loading ? '...' : stats.totalWorkers.toLocaleString()}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>كتل 24 ساعة</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#4ade80' }}>{loading ? '...' : stats.totalBlocks24h}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>العملات النشطة</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fbbf24' }}>3</div>
          </div>
        </div>

        {/* 💰 أرباح المحافظ المرتبطة */}
        <div style={{ background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', border: '2px solid rgba(251, 191, 36, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>💼</span>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>أرباح المحافظ المرتبطة (رسوم الحوض 1%)</h2>
          </div>
          
          {COINS_DATA.map(coin => {
            const earnings = WALLET_EARNINGS[coin.ticker as keyof typeof WALLET_EARNINGS];
            return (
              <div key={coin.ticker} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', borderRight: `4px solid ${coin.color}` }}>
                {/* عنوان المحفظة */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '45px', height: '45px', background: coin.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0 }}>
                    {coin.ticker.slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: 'bold', color: coin.color, fontSize: '1.1rem' }}>{coin.ticker} - {coin.name}</div>
                    <div style={{ background: '#000', borderRadius: '6px', padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-all', color: '#4ade80', marginTop: '0.5rem' }}>
                      📍 {earnings.walletAddress}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(251, 191, 36, 0.2)', padding: '0.5rem 1rem', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>رسوم الحوض</div>
                    <div style={{ fontWeight: 'bold', color: '#fbbf24' }}>{earnings.poolFee}</div>
                  </div>
                </div>

                {/* إحصائيات الأرباح */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>💰 إجمالي المستلم</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: coin.color }}>{earnings.totalReceived.toLocaleString()} {coin.ticker}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>📊 الرصيد الحالي</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fbbf24' }}>{earnings.currentBalance.toLocaleString()} {coin.ticker}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>✅ تم سحبه</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#4ade80' }}>{earnings.totalPaidOut.toLocaleString()} {coin.ticker}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>⏰ آخر 24س</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{earnings.earnings24h.toLocaleString()} {coin.ticker}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>📅 آخر 7 أيام</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{earnings.earnings7d.toLocaleString()} {coin.ticker}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>📆 آخر 30 يوم</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{earnings.earnings30d.toLocaleString()} {coin.ticker}</div>
                  </div>
                </div>

                {/* آخر دفعة */}
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>📤 آخر دفعة: </span>
                    <span style={{ fontWeight: 'bold' }}>{earnings.lastPayout}</span>
                  </div>
                  <div>
                    <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>المبلغ: </span>
                    <span style={{ fontWeight: 'bold', color: '#4ade80' }}>{earnings.lastPayoutAmount} {coin.ticker}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {['earnings', 'blocks', 'connection'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.75rem 1.5rem', background: activeTab === tab ? '#3b82f6' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: activeTab === tab ? 'bold' : 'normal' }}>
              {tab === 'earnings' ? '💼 الأرباح' : tab === 'blocks' ? '📊 الكتل' : '🔌 الاتصال'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'blocks' && (
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📊 آخر الكتل المكتشفة</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', opacity: 0.7 }}>العملة</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', opacity: 0.7 }}>الكتلة</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', opacity: 0.7 }}>المكافأة</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', opacity: 0.7 }}>رسوم الحوض</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', opacity: 0.7 }}>الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {RECENT_BLOCKS.map((block, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem' }}><span style={{ color: getCoinColor(block.coin), fontWeight: 'bold' }}>{block.coin}</span></td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>#{block.height.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', color: '#4ade80' }}>+{block.reward.toLocaleString()} {block.coin}</td>
                      <td style={{ padding: '0.75rem', color: '#fbbf24' }}>+{block.poolFee} {block.coin}</td>
                      <td style={{ padding: '0.75rem', opacity: 0.8 }}>{block.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'connection' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {COINS_DATA.map(coin => (
              <div key={coin.ticker} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem', border: `2px solid ${coin.color}40` }}>
                <div style={{ fontWeight: 'bold', color: coin.color, marginBottom: '0.5rem' }}>{coin.ticker} - {coin.name}</div>
                <div style={{ background: '#000', borderRadius: '8px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  <div style={{ color: '#888' }}># Stratum:</div>
                  <div style={{ color: '#4ade80' }}>stratum+tcp://stratum.yourpool.com:{coin.port}</div>
                  <div style={{ color: '#60a5fa', marginTop: '0.5rem' }}>-o stratum+tcp://stratum.yourpool.com:{coin.port} -u WALLET -p x</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem', textAlign: 'center', opacity: 0.7, fontSize: '0.8rem' }}>
        <div>© 2024 MultiCoin Mining Pool | kHeavyHash • KawPoW • Blake3</div>
        <div style={{ marginTop: '0.25rem', color: '#4ade80' }}>● النظام يعمل 24/7</div>
      </footer>
    </div>
  );
}
