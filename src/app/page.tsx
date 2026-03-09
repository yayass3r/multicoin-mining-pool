'use client';

import { useState, useEffect, useCallback } from 'react';

// بيانات العملات
const COINS_DATA = [
  { ticker: 'KAS', name: 'Kaspa', algorithm: 'kHeavyHash', color: '#00D4AA', port: 3333, wallet: 'kaspa:qp0nl57r2t2mntlan756383khkukmjf8z7nstl066aqdr0xcjj8n54vstafuj' },
  { ticker: 'RVN', name: 'Ravencoin', algorithm: 'KawPoW', color: '#B456BE', port: 3334, wallet: 'REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y' },
  { ticker: 'ZEPH', name: 'Zephyr', algorithm: 'RandomX', color: '#1E88E5', port: 3335, wallet: 'TO_BE_ADDED' },
  { ticker: 'ALPH', name: 'Alephium', algorithm: 'Blake3', color: '#FF6B35', port: 3336, wallet: '1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b' },
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
    totalMiners: 0,
    totalWorkers: 0,
    totalBlocks24h: 0,
    coins: {}
  });
  const [loading, setLoading] = useState(true);
  const [uptime, setUptime] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');

  // جلب الإحصائيات
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
            KAS: {
              hashrate: data.kas?.poolHashrateFormatted || '0 H/s',
              miners: data.kas?.activeMiners || 0,
              workers: data.kas?.activeWorkers || 0,
              blocks24h: data.kas?.blocksFound24h || 0,
              difficulty: data.kas?.difficulty || 16384
            },
            RVN: {
              hashrate: data.rvn?.poolHashrateFormatted || '0 H/s',
              miners: data.rvn?.activeMiners || 0,
              workers: data.rvn?.activeWorkers || 0,
              blocks24h: data.rvn?.blocksFound24h || 0,
              difficulty: data.rvn?.difficulty || 0.5
            },
            ZEPH: {
              hashrate: data.zeph?.poolHashrateFormatted || '0 H/s',
              miners: data.zeph?.activeMiners || 0,
              workers: data.zeph?.activeWorkers || 0,
              blocks24h: data.zeph?.blocksFound24h || 0,
              difficulty: data.zeph?.difficulty || 50000
            },
            ALPH: {
              hashrate: data.alph?.poolHashrateFormatted || '0 H/s',
              miners: data.alph?.activeMiners || 0,
              workers: data.alph?.activeWorkers || 0,
              blocks24h: data.alph?.blocksFound24h || 0,
              difficulty: data.alph?.difficulty || 1000
            }
          }
        });
      }
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Health check
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setUptime(data.uptime || 0);
      }
    } catch (e) {
      console.error('Health error:', e);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchHealth();
    const interval = setInterval(() => {
      fetchStats();
      fetchHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchHealth]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}س ${m}د`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '1rem 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '50px',
              height: '50px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              ⛏️
            </div>
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
            <div style={{
              padding: '0.5rem 1rem',
              background: 'rgba(74, 222, 128, 0.2)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                background: '#4ade80',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}></span>
              <span style={{ fontSize: '0.875rem', color: '#4ade80' }}>نشط</span>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '0.5rem' }}>إجمالي المعدنين</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#60a5fa' }}>
              {loading ? '...' : stats.totalMiners.toLocaleString()}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '0.5rem' }}>إجمالي العمال</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#a78bfa' }}>
              {loading ? '...' : stats.totalWorkers.toLocaleString()}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '0.5rem' }}>كتل 24 ساعة</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4ade80' }}>
              {loading ? '...' : stats.totalBlocks24h}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '0.5rem' }}>العملات النشطة</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>4</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {['overview', 'connection', 'wallets'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.75rem 1.5rem',
                background: activeTab === tab ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {tab === 'overview' ? '📊 نظرة عامة' : tab === 'connection' ? '🔌 الاتصال' : '💼 المحافظ'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}>
            {COINS_DATA.map(coin => (
              <div key={coin.ticker} style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                overflow: 'hidden',
                border: `2px solid ${coin.color}40`
              }}>
                <div style={{
                  height: '4px',
                  background: coin.color
                }}></div>
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      background: coin.color,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.25rem'
                    }}>
                      {coin.ticker.slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.25rem', color: coin.color }}>{coin.name}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{coin.algorithm} | منفذ: {coin.port}</div>
                    </div>
                  </div>
                  
                  <div style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.5rem' }}>معدل الهاش</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: coin.color }}>
                      {stats.coins[coin.ticker]?.hashrate || '0 H/s'}
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>المعدنين</div>
                      <div style={{ fontWeight: 'bold' }}>{stats.coins[coin.ticker]?.miners || 0}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>العمال</div>
                      <div style={{ fontWeight: 'bold' }}>{stats.coins[coin.ticker]?.workers || 0}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>كتل 24س</div>
                      <div style={{ fontWeight: 'bold', color: '#4ade80' }}>{stats.coins[coin.ticker]?.blocks24h || 0}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>الصعوبة</div>
                      <div style={{ fontWeight: 'bold' }}>{stats.coins[coin.ticker]?.difficulty || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'connection' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {COINS_DATA.map(coin => (
              <div key={coin.ticker} style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '1.5rem',
                border: `2px solid ${coin.color}40`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: coin.color,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>
                    {coin.ticker.slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{coin.ticker} - {coin.name}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{coin.algorithm} | منفذ: {coin.port}</div>
                  </div>
                </div>
                <div style={{
                  background: '#000',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}>
                  <div style={{ color: '#888', marginBottom: '0.5rem' }}># أمر الاتصال:</div>
                  <div style={{ color: '#4ade80' }}>stratum+tcp://stratum.yourpool.com:{coin.port}</div>
                  <div style={{ color: '#888', margin: '0.5rem 0' }}># مثال:</div>
                  <div style={{ color: '#60a5fa' }}>-o stratum+tcp://stratum.yourpool.com:{coin.port} -u WALLET_ADDRESS -p x</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'wallets' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {COINS_DATA.map(coin => (
              <div key={coin.ticker} style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '1.5rem',
                border: `2px solid ${coin.color}40`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: coin.color,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>
                    {coin.ticker.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{coin.ticker}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>رسوم الحوض: 1%</div>
                  </div>
                </div>
                <div style={{
                  background: '#000',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  wordBreak: 'break-all',
                  color: coin.wallet === 'TO_BE_ADDED' ? '#f87171' : '#4ade80'
                }}>
                  {coin.wallet}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '2rem',
        textAlign: 'center',
        opacity: 0.7,
        fontSize: '0.875rem'
      }}>
        <div>© 2024 MultiCoin Mining Pool - الخوارزميات: kHeavyHash, KawPoW, RandomX, Blake3</div>
        <div style={{ marginTop: '0.5rem' }}>
          <span style={{ color: '#4ade80' }}>●</span> النظام يعمل 24/7 مع Keep-Alive
        </div>
      </footer>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
