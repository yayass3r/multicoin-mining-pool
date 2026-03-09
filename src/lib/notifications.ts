/**
 * =====================================================
 * 📊 Monitoring & Notifications System
 * =====================================================
 * 
 * نظام المراقبة والإشعارات للحوض
 * يدعم Telegram و Discord
 * 
 * @author Senior Blockchain Architect
 */

// =====================================================
// Types
// =====================================================

interface NotificationConfig {
  telegram?: {
    botToken: string;
    chatId: string;
  };
  discord?: {
    webhookUrl: string;
  };
  slack?: {
    webhookUrl: string;
  };
}

interface AlertData {
  type: 'block_found' | 'miner_connected' | 'miner_disconnected' | 'node_down' | 'high_invalid' | 'payment_sent' | 'error';
  coin?: string;
  message: string;
  data?: any;
  timestamp: number;
}

// =====================================================
// Notification Manager
// =====================================================

export class NotificationManager {
  private config: NotificationConfig;
  private alertQueue: AlertData[] = [];
  private lastSent: Map<string, number> = new Map();

  constructor(config: NotificationConfig) {
    this.config = config;
    this.startQueueProcessor();
  }

  // =====================================================
  // Queue Processor
  // =====================================================

  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 5000);
  }

  private async processQueue(): Promise<void> {
    if (this.alertQueue.length === 0) return;

    const alert = this.alertQueue.shift();
    if (!alert) return;

    // التحقق من معدل الإرسال (عدم إرسال نفس النوع أكثر من مرة كل دقيقة)
    const key = `${alert.type}:${alert.coin || 'all'}`;
    const last = this.lastSent.get(key) || 0;
    if (Date.now() - last < 60000 && alert.type !== 'block_found') {
      return;
    }

    // إرسال الإشعارات
    await Promise.allSettled([
      this.sendTelegram(alert),
      this.sendDiscord(alert),
      this.sendSlack(alert)
    ]);

    this.lastSent.set(key, Date.now());
  }

  // =====================================================
  // Add Alert
  // =====================================================

  alert(type: AlertData['type'], message: string, coin?: string, data?: any): void {
    this.alertQueue.push({
      type,
      coin,
      message,
      data,
      timestamp: Date.now()
    });
  }

  // =====================================================
  // Telegram
  // =====================================================

  private async sendTelegram(alert: AlertData): Promise<void> {
    if (!this.config.telegram?.botToken || !this.config.telegram?.chatId) return;

    const emoji = this.getEmoji(alert.type);
    const coinEmoji = alert.coin ? this.getCoinEmoji(alert.coin) : '';
    
    const text = `${emoji} *${alert.type.toUpperCase().replace(/_/g, ' ')}* ${coinEmoji}\n\n${alert.message}\n\n⏰ ${new Date(alert.timestamp).toLocaleString('ar-EG')}`;

    try {
      const url = `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`;
      
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.telegram.chatId,
          text,
          parse_mode: 'Markdown'
        })
      });
    } catch (error) {
      console.error('Telegram error:', error);
    }
  }

  // =====================================================
  // Discord
  // =====================================================

  private async sendDiscord(alert: AlertData): Promise<void> {
    if (!this.config.discord?.webhookUrl) return;

    const color = this.getColor(alert.type);
    const emoji = this.getEmoji(alert.type);

    const embed = {
      title: `${emoji} ${alert.type.toUpperCase().replace(/_/g, ' ')}`,
      description: alert.message,
      color,
      timestamp: new Date(alert.timestamp).toISOString(),
      footer: {
        text: alert.coin ? `Coin: ${alert.coin}` : 'MultiCoin Pool'
      }
    };

    try {
      await fetch(this.config.discord.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
    } catch (error) {
      console.error('Discord error:', error);
    }
  }

  // =====================================================
  // Slack
  // =====================================================

  private async sendSlack(alert: AlertData): Promise<void> {
    if (!this.config.slack?.webhookUrl) return;

    const emoji = this.getEmoji(alert.type);
    const color = alert.type === 'block_found' ? 'good' : alert.type === 'error' ? 'danger' : 'warning';

    const payload = {
      attachments: [{
        color,
        title: `${emoji} ${alert.type.toUpperCase().replace(/_/g, ' ')}`,
        text: alert.message,
        footer: alert.coin ? `Coin: ${alert.coin}` : 'MultiCoin Pool',
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };

    try {
      await fetch(this.config.slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Slack error:', error);
    }
  }

  // =====================================================
  // Helpers
  // =====================================================

  private getEmoji(type: AlertData['type']): string {
    const emojis: Record<string, string> = {
      'block_found': '🎉',
      'miner_connected': '📥',
      'miner_disconnected': '📤',
      'node_down': '🔴',
      'high_invalid': '⚠️',
      'payment_sent': '💸',
      'error': '❌'
    };
    return emojis[type] || '📊';
  }

  private getCoinEmoji(coin: string): string {
    const emojis: Record<string, string> = {
      'KAS': '⚡',
      'RVN': '🦅',
      'ALPH': '🔷'
    };
    return emojis[coin] || '💰';
  }

  private getColor(type: AlertData['type']): number {
    const colors: Record<string, number> = {
      'block_found': 0x00FF00,
      'miner_connected': 0x0099FF,
      'miner_disconnected': 0xFF9900,
      'node_down': 0xFF0000,
      'high_invalid': 0xFFCC00,
      'payment_sent': 0x00FF00,
      'error': 0xFF0000
    };
    return colors[type] || 0x808080;
  }
}

// =====================================================
// Health Monitor
// =====================================================

export class HealthMonitor {
  private notificationManager: NotificationManager;
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private status: Map<string, boolean> = new Map();

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager;
  }

  // إضافة فحص
  addCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.checks.set(name, checkFn);
    this.status.set(name, true);
  }

  // بدء المراقبة
  start(intervalMs: number = 60000): void {
    setInterval(async () => {
      await this.runChecks();
    }, intervalMs);
  }

  // تشغيل الفحوصات
  private async runChecks(): Promise<void> {
    for (const [name, checkFn] of this.checks) {
      try {
        const result = await checkFn();
        const previousStatus = this.status.get(name);

        this.status.set(name, result);

        // إرسال تنبيه إذا تغيرت الحالة
        if (previousStatus && !result) {
          this.notificationManager.alert('node_down', `${name} is down!`, undefined, { name });
        }
      } catch (error) {
        this.status.set(name, false);
        this.notificationManager.alert('error', `${name} check failed: ${error}`, undefined, { name, error });
      }
    }
  }

  // الحصول على الحالة
  getStatus(): Record<string, boolean> {
    return Object.fromEntries(this.status);
  }
}

// =====================================================
// مثال الاستخدام
// =====================================================

/*
const notificationManager = new NotificationManager({
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK
  }
});

const healthMonitor = new HealthMonitor(notificationManager);

// إضافة فحوصات
healthMonitor.addCheck('kaspa-node', async () => {
  const res = await fetch('http://localhost:16110/');
  return res.ok;
});

healthMonitor.addCheck('ravencoin-node', async () => {
  const res = await fetch('http://localhost:8766/');
  return res.ok;
});

healthMonitor.start();

// إرسال إشعارات
notificationManager.alert('block_found', 'New KAS block found! Reward: 10 KAS', 'KAS');
notificationManager.alert('payment_sent', 'Payment of 5.5 KAS sent to kaspa:qpp...', 'KAS');
*/

export default NotificationManager;
