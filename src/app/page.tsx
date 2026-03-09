'use client';

import { useState, useEffect, useCallback } from 'react';

// =====================================================
// الأنواع
// =====================================================

interface CoinStats {
  enabled: boolean;
  name: string;
  algorithm: string;
  hashrate: number;
  miners: number;
  workers: number;
  blocks24h: number;
  sharesPerSecond: number;
  lastShare: number;
  totalMined: number;
  pendingPayout: number;
  difficulty: number;
  networkHashrate: number;
  networkDifficulty: number;
  blockReward: number;
  price: number;
  blockHeight: number;
  nodeConnected: boolean;
  nodeSynced: boolean;
  stratumPort: number;
}

interface LiveStats {
  success: boolean;
  mode: string;
  timestamp: number;
  uptime: number;
  isRunning: boolean;
  totalBlocksFound: number;
  totalShares: number;
  lastBlockTime: number | null;
  lastShareTime: number | null;
  hashrate: { total: number; formatted: string };
  miners: number;
  blocks24h: number;
  coins: Record<string, CoinStats>;
  wallets: Record<string, string>;
  nodeConnections: Record<string, { connected: boolean; synced: boolean; lastPing: number | null }>;
}

// =====================================================
// بيانات العملات
// =====================================================

const COINS_CONFIG = {
  KAS: { name: 'Kaspa', algorithm: 'kHeavyHash', color: '#00D4AA', icon: '⚡' },
  RVN: { name: 'Ravencoin', algorithm: 'KawPoW', color: '#B456BE', icon: '🦅' },
  ALPH: { name: 'Alephium', algorithm: 'Blake3', color: '#FF6B35', icon: '🔷' }
};

// =====================================================
// الصفحة الرئيسية
// =====================================================

export default function MiningPoolPage() {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);

  // جلب البيانات الحية
  const fetchLiveStats = useCallback(async () => {
    try {
      const res = await fetch('/api/live-stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setError(null);
      }
    } catch (e) {
      setError('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 2000);
    return () => clearInterval(interval);
  }, [fetchLiveStats]);

  // تنسيق الوقت
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}ي ${h}س ${m}د`;
    return `${h}س ${m}د ${s}ث`;
  };

  // تنسيق Hashrate
  const formatHashrate = (hashrate: number) => {
    if (hashrate >= 1e15) return (hashrate / 1e15).toFixed(2) + ' PH/s';
    if (hashrate >= 1e12) return (hashrate / 1e12).toFixed(2) + ' TH/s';
    if (hashrate >= 1e9) return (hashrate / 1e9).toFixed(2) + ' GH/s';
    if (hashrate >= 1e6) return (hashrate / 1e6).toFixed(2) + ' MH/s';
    if (hashrate >= 1e3) return (hashrate / 1e3).toFixed(2) + ' KH/s';
    return hashrate.toFixed(2) + ' H/s';
  };

  // تنسيق الأرقام
  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  // حساب الأرباح بالدولار
  const calculateProfit = () => {
    if (!stats?.coins) return { daily: 0, total: 0 };
    let daily = 0;
    let total = 0;
    for (const [, data] of Object.entries(stats.coins)) {
      daily += data.pendingPayout * data.price;
      total += data.totalMined * data.price;
    }
    return { daily, total };
  };

  const profit = calculateProfit();

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '1rem 2rem', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)' }}>⛏️</div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>MultiCoin Mining Pool</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>تعدين 24/7 | KAS • RVN • ALPH</span>
                <span style={{ background: stats?.mode === 'production' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(251, 191, 36, 0.3)', padding: '0.125rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', color: stats?.mode === 'production' ? '#4ade80' : '#fbbf24' }}>
                  {stats?.mode === 'production' ? '🟢 PRODUCTION' : '🟡 SIMULATION'}
                </span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* حالة التعدين */}
            <div style={{ padding: '0.5rem 1rem', background: stats?.isRunning ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '10px', height: '10px', background: stats?.isRunning ? '#4ade80' : '#ef4444', borderRadius: '50%', animation: stats?.isRunning ? 'pulse 1s infinite' : 'none' }}></span>
              <span style={{ fontWeight: 'bold', color: stats?.isRunning ? '#4ade80' : '#ef4444' }}>
                {stats?.isRunning ? '⛏️ التعدين نشط' : '⏸️ متوقف'}
              </span>
            </div>
            
            {/* زر الاتصال */}
            <button 
              onClick={() => setShowConnect(!showConnect)}
              style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🔗 الاتصال بالحوض
            </button>
            
            {/* وقت التشغيل */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>وقت التشغيل</div>
              <div style={{ fontWeight: 'bold', color: '#60a5fa' }}>{stats ? formatUptime(stats.uptime) : '...'}</div>
            </div>
          </div>
        </div>
      </header>

      {/* نافذة الاتصال */}
      {showConnect && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#1a1a2e', borderRadius: '16px', padding: '2rem', zIndex: 1000, minWidth: '500px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>🔗 تعليمات الاتصال</h3>
            <button onClick={() => setShowConnect(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>
          
          {stats && Object.entries(stats.coins).map(([ticker, coin]) => {
            const config = COINS_CONFIG[ticker as keyof typeof COINS_CONFIG];
            if (!config || !coin.enabled) return null;
            
            return (
              <div key={ticker} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 'bold', color: config.color, marginBottom: '0.5rem' }}>{config.icon} {ticker} - {config.name}</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '0.5rem' }}>الخوارزمية: {config.algorithm}</div>
                <code style={{ fontSize: '0.75rem', background: '#000', padding: '0.5rem 1rem', borderRadius: '4px', display: 'block', color: '#4ade80', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
                  stratum+tcp://pool.multicoin.com:{coin.stratumPort}
                </code>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  المحفظة: <code style={{ color: '#4ade80' }}>{stats.wallets[ticker]?.slice(0, 40)}...</code>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
        {/* الإحصائيات الرئيسية */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.2) 0%, rgba(96, 165, 250, 0.05) 100%)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>⚡ Hashrate الإجمالي</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#60a5fa' }}>
              {loading ? '...' : stats ? stats.hashrate.formatted : '0'}
            </div>
          </div>
          
          <div style={{ background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(167, 139, 250, 0.05) 100%)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>👷 المعدنين</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#a78bfa' }}>
              {loading ? '...' : stats?.miners.toLocaleString() || '0'}
            </div>
          </div>
          
          <div style={{ background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.2) 0%, rgba(74, 222, 128, 0.05) 100%)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(74, 222, 128, 0.3)' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>📦 كتل 24 ساعة</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#4ade80' }}>
              {loading ? '...' : stats?.blocks24h || '0'}
            </div>
          </div>
          
          <div style={{ background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(251, 191, 36, 0.05) 100%)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>💰 الأرباح المعلقة</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fbbf24' }}>
              ${loading ? '...' : profit.daily.toFixed(2)}
            </div>
          </div>
          
          <div style={{ background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(236, 72, 153, 0.05) 100%)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>🎯 إجمالي الكتل</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ec4899' }}>
              {loading ? '...' : stats?.totalBlocksFound || '0'}
            </div>
          </div>
          
          <div style={{ background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0.05) 100%)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(34, 211, 238, 0.3)' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>📊 إجمالي الشيرات</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#22d3ee' }}>
              {loading ? '...' : formatNumber(stats?.totalShares || 0)}
            </div>
          </div>
        </div>

        {/* بطاقات العملات */}
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          💰 العملات النشطة
        </h2>
        
        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
          {stats && Object.entries(stats.coins).map(([ticker, coin]) => {
            const config = COINS_CONFIG[ticker as keyof typeof COINS_CONFIG];
            if (!config || !coin.enabled) return null;
            
            return (
              <div key={ticker} style={{ 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: '16px', 
                padding: '1.5rem', 
                borderRight: `4px solid ${config.color}`,
                border: `1px solid ${config.color}30`,
                transition: 'transform 0.2s'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: '50px', 
                      height: '50px', 
                      background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}80 100%)`, 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontWeight: 'bold',
                      fontSize: '1.5rem',
                      boxShadow: `0 4px 20px ${config.color}40`
                    }}>
                      {config.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: config.color }}>{ticker} - {config.name}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>الخوارزمية: {config.algorithm} | المنفذ: {coin.stratumPort}</div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>حالة العقدة</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <span style={{ width: '8px', height: '8px', background: coin.nodeConnected ? '#4ade80' : '#fbbf24', borderRadius: '50%' }}></span>
                      <span style={{ color: coin.nodeConnected ? '#4ade80' : '#fbbf24', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {coin.nodeConnected ? 'متصل' : 'محلي'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* إحصائيات */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>⚡ Hashrate</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: config.color }}>{formatHashrate(coin.hashrate)}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>👷 المعدنين</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{coin.miners.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>📦 كتل 24س</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#4ade80' }}>{coin.blocks24h}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>📍 الارتفاع</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{coin.blockHeight.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>💰 إجمالي المحصل</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24' }}>{coin.totalMined.toFixed(4)} {ticker}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>⏳ بانتظار السحب</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#60a5fa' }}>{coin.pendingPayout.toFixed(4)} {ticker}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>💵 القيمة ($)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ec4899' }}>${(coin.pendingPayout * coin.price).toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.875rem' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.25rem' }}>🎯 الصعوبة</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{formatNumber(coin.difficulty)}</div>
                  </div>
                </div>

                {/* المحفظة */}
                <div style={{ background: '#000', borderRadius: '8px', padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#888' }}>💼 المحفظة:</span>
                  <span style={{ color: '#4ade80' }}>{stats.wallets[ticker]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* معلومات الاتصال */}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>🔗 معلومات الحوض</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', opacity: 0.8 }}>📊 رسوم الحوض</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>1%</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', opacity: 0.8 }}>💰 الحد الأدنى للسحب</div>
              <div style={{ fontSize: '0.9rem' }}>
                KAS: 1 | RVN: 10 | ALPH: 0.5
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', opacity: 0.8 }}>⏱️ وقت الدفعات</div>
              <div style={{ fontSize: '1rem' }}>كل ساعة تلقائياً</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1.5rem', textAlign: 'center', opacity: 0.7, fontSize: '0.85rem', marginTop: '2rem' }}>
        <div>© 2024 MultiCoin Mining Pool | تعدين 24/7 | kHeavyHash • KawPoW • Blake3</div>
        <div style={{ marginTop: '0.5rem', color: '#4ade80' }}>
          ⛏️ التعدين يعمل تلقائياً - {stats?.mode === 'production' ? 'وضع الإنتاج' : 'وضع المحاكاة'}
        </div>
      </footer>

      {/* CSS للأنيميشن */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
