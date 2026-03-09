'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  Users, 
  Box, 
  Zap, 
  TrendingUp, 
  Server, 
  Wallet, 
  Settings,
  ChevronRight,
  Circle,
  Cpu,
  HardDrive,
  Network,
  DollarSign,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

// =====================================================
// أنواع البيانات
// =====================================================
interface CoinStats {
  coin: string;
  name: string;
  algorithm: string;
  enabled: boolean;
  poolHashrate: number;
  poolHashrateFormatted: string;
  activeMiners: number;
  activeWorkers: number;
  blocksFound24h: number;
  lastBlockTime: number;
  lastBlockHeight: number;
  currentHeight: number;
  networkDifficulty: number;
  stratumPort: number;
  difficulty: number;
  minPayout: number;
  poolFee: number;
  networkHashrate: number;
  blockReward: number;
  walletAddress: string;
  color: string;
}

interface PoolData {
  pool: {
    name: string;
    version: string;
    timestamp: number;
  };
  total: {
    totalMiners: number;
    totalWorkers: number;
    totalBlocks24h: number;
  };
  [key: string]: unknown;
}

// =====================================================
// بيانات العملات الثابتة
// =====================================================
const COINS = [
  { ticker: 'KAS', name: 'Kaspa', algorithm: 'kHeavyHash', color: '#00D4AA', port: 3333 },
  { ticker: 'RVN', name: 'Ravencoin', algorithm: 'KawPoW', color: '#B456BE', port: 3334 },
  { ticker: 'ZEPH', name: 'Zephyr Protocol', algorithm: 'RandomX', color: '#1E88E5', port: 3335 },
  { ticker: 'ALPH', name: 'Alephium', algorithm: 'Blake3', color: '#FF6B35', port: 3336 },
];

// =====================================================
// مكون البطاقة الرئيسية للعملة
// =====================================================
function CoinCard({ coin, stats }: { coin: typeof COINS[0]; stats: CoinStats | null }) {
  const [hashrateHistory, setHashrateHistory] = useState<number[]>([]);
  
  useEffect(() => {
    if (stats) {
      setHashrateHistory(prev => {
        const newHistory = [...prev, stats.poolHashrate];
        return newHistory.slice(-20);
      });
    }
  }, [stats]);

  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ساعة`;
    return `${Math.floor(hours / 24)} يوم`;
  };

  return (
    <Card className="relative overflow-hidden border-2 hover:shadow-xl transition-all duration-300" 
           style={{ borderColor: coin.color + '40' }}>
      {/* شريط اللون العلوي */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: coin.color }} />
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                 style={{ backgroundColor: coin.color }}>
              {coin.ticker.slice(0, 2)}
            </div>
            <div>
              <CardTitle className="text-xl" style={{ color: coin.color }}>{coin.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{coin.algorithm}</Badge>
                <span className="flex items-center gap-1 text-xs">
                  <Server className="w-3 h-3" />
                  منفذ: {coin.port}
                </span>
              </CardDescription>
            </div>
          </div>
          <Badge className={`${stats?.enabled ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            {stats?.enabled ? 'نشط' : 'متوقف'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* معدل الهاش */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" /> معدل الهاش
            </span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold" style={{ color: coin.color }}>
            {stats?.poolHashrateFormatted || '0 MH/s'}
          </div>
          <Progress value={65} className="h-1 mt-2" style={{ backgroundColor: coin.color + '20' }} />
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs">المعدنين</span>
            </div>
            <div className="text-xl font-bold">{formatNumber(stats?.activeMiners || 0)}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Cpu className="w-4 h-4" />
              <span className="text-xs">العمال</span>
            </div>
            <div className="text-xl font-bold">{formatNumber(stats?.activeWorkers || 0)}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Box className="w-4 h-4" />
              <span className="text-xs">كتل 24س</span>
            </div>
            <div className="text-xl font-bold text-green-500">{stats?.blocksFound24h || 0}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">آخر كتلة</span>
            </div>
            <div className="text-sm font-bold">
              {stats?.lastBlockTime ? formatTime(stats.lastBlockTime) : '-'}
            </div>
          </div>
        </div>

        {/* معلومات إضافية */}
        <div className="flex items-center justify-between text-sm pt-2 border-t">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-yellow-500" />
            <span className="text-muted-foreground">رسوم: {stats?.poolFee || 1}%</span>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive className="w-4 h-4 text-blue-500" />
            <span className="text-muted-foreground">صعوبة: {stats?.difficulty || '-'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// مكون سجل الكتل المكتشفة
// =====================================================
function BlockLog() {
  const [blocks, setBlocks] = useState<Array<{
    coin: string;
    height: number;
    reward: number;
    time: string;
    status: 'confirmed' | 'pending' | 'orphaned';
  }>>([]);

  // بيانات الكتل الثابتة
  const mockBlocks = [
    { coin: 'KAS', height: 1234567, reward: 10, time: 'منذ 5 دقائق', status: 'confirmed' as const },
    { coin: 'RVN', height: 2345678, reward: 2500, time: 'منذ 12 دقيقة', status: 'confirmed' as const },
    { coin: 'ALPH', height: 3456789, reward: 3, time: 'منذ 23 دقيقة', status: 'pending' as const },
    { coin: 'KAS', height: 1234560, reward: 10, time: 'منذ 45 دقيقة', status: 'confirmed' as const },
    { coin: 'ZEPH', height: 4567890, reward: 2.5, time: 'منذ ساعة', status: 'confirmed' as const },
    { coin: 'RVN', height: 2345670, reward: 2500, time: 'منذ ساعتين', status: 'confirmed' as const },
    { coin: 'ALPH', height: 3456780, reward: 3, time: 'منذ 3 ساعات', status: 'orphaned' as const },
  ];

  useEffect(() => {
    setBlocks(mockBlocks);
  }, [mockBlocks]);

  const getCoinColor = (coin: string) => {
    const colors: Record<string, string> = {
      KAS: '#00D4AA',
      RVN: '#B456BE',
      ZEPH: '#1E88E5',
      ALPH: '#FF6B35'
    };
    return colors[coin] || '#888';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'orphaned': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Box className="w-5 h-5" />
          آخر الكتل المكتشفة
        </CardTitle>
        <CardDescription>قائمة بأحدث الكتل التي تم تعدينها</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {blocks.map((block, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                       style={{ backgroundColor: getCoinColor(block.coin) }}>
                    {block.coin}
                  </div>
                  <div>
                    <div className="font-medium">كتلة #{block.height.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">{block.time}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <div className="font-medium text-green-500">+{block.reward} {block.coin}</div>
                    <div className="flex items-center gap-1">
                      <Circle className={`w-2 h-2 ${getStatusColor(block.status)}`} />
                      <span className="text-xs text-muted-foreground">
                        {block.status === 'confirmed' ? 'مؤكدة' : block.status === 'pending' ? 'قيد التأكيد' : 'يتيمة'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// =====================================================
// مكون نشاط التعدين المباشر
// =====================================================
function LiveMiningActivity() {
  const [activities, setActivities] = useState<Array<{
    type: 'share' | 'block' | 'connect' | 'disconnect';
    miner: string;
    coin: string;
    time: string;
    hashrate?: string;
  }>>([]);

  useEffect(() => {
    const activityTypes = ['share', 'share', 'share', 'share', 'connect', 'block'];
    const coins = ['KAS', 'RVN', 'ZEPH', 'ALPH'];
    
    const interval = setInterval(() => {
      const type = activityTypes[Math.floor(Math.random() * activityTypes.length)] as typeof activities[0]['type'];
      const coin = coins[Math.floor(Math.random() * coins.length)];
      const minerId = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const newActivity = {
        type,
        miner: `miner_${minerId}`,
        coin,
        time: new Date().toLocaleTimeString('ar-SA'),
        hashrate: `${(Math.random() * 100).toFixed(2)} MH/s`
      };
      
      setActivities(prev => [newActivity, ...prev].slice(0, 50));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'share': return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'block': return <Box className="w-4 h-4 text-green-500" />;
      case 'connect': return <ArrowUpRight className="w-4 h-4 text-blue-500" />;
      case 'disconnect': return <ArrowDownRight className="w-4 h-4 text-red-500" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const getActivityText = (activity: typeof activities[0]) => {
    switch (activity.type) {
      case 'share': return `شار مقبول من ${activity.miner}`;
      case 'block': return `كتلة جديدة بواسطة ${activity.miner}!`;
      case 'connect': return `${activity.miner} متصل`;
      case 'disconnect': return `${activity.miner} قطع الاتصال`;
      default: return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 animate-pulse text-green-500" />
          نشاط التعدين المباشر
        </CardTitle>
        <CardDescription>تحديثات فورية من المعدنين</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors animate-pulse">
                {getActivityIcon(activity.type)}
                <div className="flex-1">
                  <span className="text-sm">{getActivityText(activity)}</span>
                  <Badge variant="outline" className="ml-2 text-xs">{activity.coin}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// =====================================================
// مكون تفاصيل الاتصال
// =====================================================
function ConnectionDetails() {
  const connectionInfo = [
    { coin: 'KAS', algorithm: 'kHeavyHash', port: 3333, host: 'stratum.yourpool.com', difficulty: '16384' },
    { coin: 'RVN', algorithm: 'KawPoW', port: 3334, host: 'stratum.yourpool.com', difficulty: '0.5' },
    { coin: 'ZEPH', algorithm: 'RandomX', port: 3335, host: 'stratum.yourpool.com', difficulty: '50000' },
    { coin: 'ALPH', algorithm: 'Blake3', port: 3336, host: 'stratum.yourpool.com', difficulty: '1000' },
  ];

  const getCoinColor = (coin: string) => {
    const colors: Record<string, string> = {
      KAS: '#00D4AA',
      RVN: '#B456BE',
      ZEPH: '#1E88E5',
      ALPH: '#FF6B35'
    };
    return colors[coin] || '#888';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5" />
          تفاصيل الاتصال (Stratum)
        </CardTitle>
        <CardDescription>استخدم هذه البيانات لتوصيل برنامج التعدين</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {connectionInfo.map((info) => (
            <div key={info.coin} className="p-4 rounded-lg border-2" style={{ borderColor: getCoinColor(info.coin) + '40' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                       style={{ backgroundColor: getCoinColor(info.coin) }}>
                    {info.coin.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium">{info.coin}</div>
                    <div className="text-xs text-muted-foreground">{info.algorithm}</div>
                  </div>
                </div>
                <Badge variant="outline">{info.port}</Badge>
              </div>
              <div className="bg-muted rounded p-2 font-mono text-sm">
                <div className="text-muted-foreground"># أمر الاتصال:</div>
                <div className="text-green-600">stratum+tcp://{info.host}:{info.port}</div>
                <div className="text-muted-foreground mt-2"># مثال لـ T-Rex/BzMiner:</div>
                <div className="text-blue-600">-o stratum+tcp://{info.host}:{info.port} -u WALLET_ADDRESS -p x</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// مكون المحافظ والمدفوعات
// =====================================================
function WalletInfo() {
  const wallets = [
    { coin: 'KAS', address: 'kaspa:qp0nl57r2t2mntlan756383khkukmjf8z7nstl066aqdr0xcjj8n54vstafuj', fee: '1%' },
    { coin: 'RVN', address: 'REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y', fee: '1%' },
    { coin: 'ZEPH', address: 'سيتم إضافته لاحقاً', fee: '1%' },
    { coin: 'ALPH', address: '1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b', fee: '1%' },
  ];

  const getCoinColor = (coin: string) => {
    const colors: Record<string, string> = {
      KAS: '#00D4AA',
      RVN: '#B456BE',
      ZEPH: '#1E88E5',
      ALPH: '#FF6B35'
    };
    return colors[coin] || '#888';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          عناوين المحافظ (Pool Wallets)
        </CardTitle>
        <CardDescription>المحافظ المستخدمة لاستقبال رسوم الحوض</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {wallets.map((wallet) => (
            <div key={wallet.coin} className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                       style={{ backgroundColor: getCoinColor(wallet.coin) }}>
                    {wallet.coin.slice(0, 1)}
                  </div>
                  <span className="font-medium">{wallet.coin}</span>
                </div>
                <Badge variant="outline">رسوم: {wallet.fee}</Badge>
              </div>
              <div className="bg-background rounded p-2 font-mono text-xs break-all border">
                {wallet.address}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// المكون الرئيسي
// =====================================================
export default function MiningPoolDashboard() {
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchPoolStats = useCallback(async () => {
    try {
      const response = await fetch('/api/pool/stats');
      const data = await response.json();
      setPoolData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching pool stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoolStats();
    const interval = setInterval(fetchPoolStats, 10000); // تحديث كل 10 ثواني
    return () => clearInterval(interval);
  }, [fetchPoolStats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* الهيدر */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">MultiCoin Mining Pool</h1>
                <p className="text-sm text-slate-400">حوض تعدين متعدد العملات</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-left hidden sm:block">
                <div className="text-sm text-slate-400">آخر تحديث</div>
                <div className="text-white font-mono">{lastUpdate.toLocaleTimeString('ar-SA')}</div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-green-500/20 text-green-400">
                <Circle className="w-2 h-2 fill-green-500 animate-pulse" />
                <span className="text-sm">النظام نشط</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* الإحصائيات العامة */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">إجمالي المعدنين</div>
                  <div className="text-2xl font-bold text-white">
                    {loading ? '...' : (poolData?.total?.totalMiners || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">إجمالي العمال</div>
                  <div className="text-2xl font-bold text-white">
                    {loading ? '...' : (poolData?.total?.totalWorkers || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Box className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">كتل 24 ساعة</div>
                  <div className="text-2xl font-bold text-green-400">
                    {loading ? '...' : poolData?.total?.totalBlocks24h || 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400">العملات النشطة</div>
                  <div className="text-2xl font-bold text-yellow-400">4</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* التبويبات */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600">نظرة عامة</TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-blue-600">التعدين المباشر</TabsTrigger>
            <TabsTrigger value="connection" className="data-[state=active]:bg-blue-600">الاتصال</TabsTrigger>
            <TabsTrigger value="wallets" className="data-[state=active]:bg-blue-600">المحافظ</TabsTrigger>
          </TabsList>

          {/* تبويب النظرة العامة */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {COINS.map((coin) => (
                <CoinCard 
                  key={coin.ticker} 
                  coin={coin} 
                  stats={poolData?.[coin.ticker.toLowerCase()] as CoinStats} 
                />
              ))}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <BlockLog />
              <WalletInfo />
            </div>
          </TabsContent>

          {/* تبويب التعدين المباشر */}
          <TabsContent value="live">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LiveMiningActivity />
              <BlockLog />
            </div>
          </TabsContent>

          {/* تبويب الاتصال */}
          <TabsContent value="connection">
            <ConnectionDetails />
          </TabsContent>

          {/* تبويب المحافظ */}
          <TabsContent value="wallets">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WalletInfo />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    إعدادات الدفع
                  </CardTitle>
                  <CardDescription>حدود الدفع الأدنى لكل عملة</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { coin: 'KAS', minPayout: '100 KAS', interval: 'كل ساعة' },
                      { coin: 'RVN', minPayout: '10 RVN', interval: 'كل ساعة' },
                      { coin: 'ZEPH', minPayout: '0.1 ZEPH', interval: 'كل ساعة' },
                      { coin: 'ALPH', minPayout: '1 ALPH', interval: 'كل ساعة' },
                    ].map((payout) => (
                      <div key={payout.coin} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Badge>{payout.coin}</Badge>
                          <span className="text-muted-foreground">الحد الأدنى:</span>
                          <span className="font-medium">{payout.minPayout}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{payout.interval}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* الفوتر */}
      <footer className="border-t border-slate-700 bg-slate-900/50 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-400 text-sm">
              © 2024 MultiCoin Mining Pool. جميع الحقوق محفوظة.
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <span>الإصدار: 1.0.0</span>
              <span>•</span>
              <span>الخوارزميات: kHeavyHash, KawPoW, RandomX, Blake3</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
