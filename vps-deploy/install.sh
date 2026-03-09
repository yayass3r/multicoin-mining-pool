#!/bin/bash
# =====================================================
# 🚀 VPS Mining Pool Auto-Installer
# =====================================================
# 
# هذا السكريبت يقوم بتثبيت كل ما يلزم لتشغيل
# حوض التعدين على VPS
#
# الاستخدام:
# curl -fsSL https://raw.githubusercontent.com/yayass3r/multicoin-mining-pool/main/vps-deploy/install.sh | bash
#
# @author Senior Blockchain Architect
# =====================================================

set -e

# الألوان
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# المتغيرات
MINING_DIR="/opt/mining-pool"
LOG_FILE="/var/log/mining-pool-install.log"

# =====================================================
# دوال مساعدة
# =====================================================

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a $LOG_FILE
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a $LOG_FILE
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "هذا السكريبت يجب أن يعمل كـ root. استخدم: sudo bash $0"
    fi
}

# =====================================================
# فحص متطلبات النظام
# =====================================================

check_system() {
    log "🔍 فحص متطلبات النظام..."
    
    # فحص نظام التشغيل
    if [[ ! -f /etc/os-release ]]; then
        error "نظام تشغيل غير مدعوم"
    fi
    
    source /etc/os-release
    
    log "   OS: $PRETTY_NAME"
    log "   Kernel: $(uname -r)"
    
    # فحص الذاكرة
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
    log "   RAM: ${TOTAL_MEM}MB"
    
    if [[ $TOTAL_MEM -lt 8000 ]]; then
        warn "الذاكرة أقل من 8GB - يُنصح بـ 16GB+ للعقد الكاملة"
    fi
    
    # فحص القرص
    TOTAL_DISK=$(df -BG / | awk 'NR==2 {print $2}' | sed 's/G//')
    log "   Disk: ${TOTAL_DISK}GB"
    
    if [[ $TOTAL_DISK -lt 500 ]]; then
        warn "مساحة القرص أقل من 500GB - العقد تحتاج مساحة كبيرة"
    fi
    
    # فحص CPU
    CPU_CORES=$(nproc)
    log "   CPU Cores: $CPU_CORES"
    
    if [[ $CPU_CORES -lt 4 ]]; then
        warn "أقل من 4 أنوية CPU - يُنصح بـ 8+ أنوية"
    fi
    
    log "✅ فحص النظام مكتمل"
}

# =====================================================
# تثبيت المتطلبات
# =====================================================

install_dependencies() {
    log "📦 تثبيت المتطلبات..."
    
    # تحديث النظام
    log "   تحديث قواعد البيانات..."
    apt-get update -qq
    
    # تثبيت الأدوات الأساسية
    log "   تثبيت الأدوات الأساسية..."
    apt-get install -y -qq \
        curl wget git \
        build-essential \
        libssl-dev \
        libffi-dev \
        python3 python3-pip \
        jq htop tmux \
        ufw fail2ban \
        nginx certbot python3-certbot-nginx \
        >> $LOG_FILE 2>&1
    
    log "✅ المتطلبات الأساسية مثبتة"
}

# =====================================================
# تثبيت Docker
# =====================================================

install_docker() {
    if command -v docker &> /dev/null; then
        log "✅ Docker موجود: $(docker --version)"
        return
    fi
    
    log "🐳 تثبيت Docker..."
    
    # تثبيت Docker
    curl -fsSL https://get.docker.com | sh >> $LOG_FILE 2>&1
    
    # تثبيت Docker Compose
    apt-get install -y -qq docker-compose-plugin >> $LOG_FILE 2>&1
    
    # تشغيل Docker
    systemctl enable docker
    systemctl start docker
    
    # إضافة المستخدم الحالي
    if [[ -n $SUDO_USER ]]; then
        usermod -aG docker $SUDO_USER
    fi
    
    log "✅ Docker مثبت: $(docker --version)"
}

# =====================================================
# تثبيت Node.js و Bun
# =====================================================

install_nodejs() {
    if command -v bun &> /dev/null; then
        log "✅ Bun موجود: $(bun --version)"
        return
    fi
    
    log "📦 تثبيت Node.js و Bun..."
    
    # تثبيت Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> $LOG_FILE 2>&1
    apt-get install -y -qq nodejs >> $LOG_FILE 2>&1
    
    # تثبيت Bun
    curl -fsSL https://bun.sh/install | bash >> $LOG_FILE 2>&1
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    log "✅ Node.js: $(node --version)"
    log "✅ Bun: $(bun --version)"
}

# =====================================================
# تثبيت Redis
# =====================================================

install_redis() {
    if command -v redis-server &> /dev/null; then
        log "✅ Redis موجود"
        return
    fi
    
    log "🗄️ تثبيت Redis..."
    
    apt-get install -y -qq redis-server >> $LOG_FILE 2>&1
    
    # تكوين Redis
    sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf
    sed -i 's/# maxmemory <bytes>/maxmemory 2gb/' /etc/redis/redis.conf
    sed -i 's/# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
    
    systemctl enable redis-server
    systemctl start redis-server
    
    log "✅ Redis يعمل على المنفذ 6379"
}

# =====================================================
# إعداد جدار الحماية
# =====================================================

setup_firewall() {
    log "🔥 إعداد جدار الحماية..."
    
    # إعادة تعيين القواعد
    ufw --force reset >> $LOG_FILE 2>&1
    
    # السماح بالاتصالات الأساسية
    ufw default deny incoming
    ufw default allow outgoing
    
    # SSH
    ufw allow 22/tcp comment 'SSH'
    
    # HTTP/HTTPS
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    
    # Dashboard
    ufw allow 10000/tcp comment 'Mining Dashboard'
    
    # Stratum Ports
    ufw allow 3333/tcp comment 'KAS Stratum'
    ufw allow 3334/tcp comment 'RVN Stratum'
    ufw allow 3336/tcp comment 'ALPH Stratum'
    
    # RPC Ports (للشبكة الداخلية فقط)
    # ufw allow from 10.0.0.0/8 to any port 16110 comment 'Kaspa RPC'
    # ufw allow from 10.0.0.0/8 to any port 8766 comment 'Raven RPC'
    # ufw allow from 10.0.0.0/8 to any port 12973 comment 'Alephium API'
    
    # تفعيل الجدار
    ufw --force enable >> $LOG_FILE 2>&1
    
    log "✅ جدار الحماية مُفعّل"
    ufw status
}

# =====================================================
# استنساخ المشروع
# =====================================================

clone_project() {
    log "📥 استنساخ المشروع..."
    
    rm -rf $MINING_DIR
    mkdir -p $MINING_DIR
    
    git clone https://github.com/yayass3r/multicoin-mining-pool.git $MINING_DIR >> $LOG_FILE 2>&1
    
    cd $MINING_DIR
    
    # تثبيت المتطلبات
    log "   تثبيت متطلبات المشروع..."
    bun install >> $LOG_FILE 2>&1
    
    # بناء المشروع
    log "   بناء المشروع..."
    bun run build >> $LOG_FILE 2>&1
    
    log "✅ المشروع جاهز في $MINING_DIR"
}

# =====================================================
# إنشاء ملف البيئة
# =====================================================

create_env_file() {
    log "📝 إنشاء ملف البيئة..."
    
    cat > $MINING_DIR/.env << 'EOF'
# =====================================================
# MultiCoin Mining Pool Configuration
# =====================================================

# Node Environment
NODE_ENV=production
PORT=10000
HOST=0.0.0.0

# Wallets - غيّر هذه العناوين إلى محافظك!
KAS_WALLET=kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86
RVN_WALLET=REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y
ALPH_WALLET=1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b

# Redis
REDIS_URL=redis://localhost:6379

# Kaspa Node (Docker)
KASPA_RPC_HOST=127.0.0.1
KASPA_RPC_PORT=16110
KASPA_RPC_USER=kaspa_rpc
KASPA_RPC_PASS=CHANGE_THIS_PASSWORD

# Ravencoin Node (Docker)
RAVEN_RPC_HOST=127.0.0.1
RAVEN_RPC_PORT=8766
RAVEN_RPC_USER=raven_rpc
RAVEN_RPC_PASS=CHANGE_THIS_PASSWORD

# Alephium Node (Docker)
ALEPHIUM_API_HOST=127.0.0.1
ALEPHIUM_API_PORT=12973
ALEPHIUM_API_KEY=CHANGE_THIS_API_KEY

# Pool Settings
POOL_FEE=1.0
MIN_PAYOUT_KAS=1.0
MIN_PAYOUT_RVN=10.0
MIN_PAYOUT_ALPH=0.5

# Notifications (Optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
DISCORD_WEBHOOK=

# Keep-Alive (for Render.com)
RENDER_EXTERNAL_URL=
EOF

    log "✅ ملف .env مُنشأ - غيّر كلمات المرور!"
}

# =====================================================
# إنشاء خدمات Systemd
# =====================================================

create_systemd_services() {
    log "⚡ إنشاء خدمات النظام..."
    
    # خدمة الخادم الرئيسي
    cat > /etc/systemd/system/mining-pool.service << 'EOF'
[Unit]
Description=MultiCoin Mining Pool Server
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/mining-pool
Environment="NODE_ENV=production"
EnvironmentFile=/opt/mining-pool/.env
ExecStart=/root/.bun/bin/bun run server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mining-pool

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/mining-pool

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable mining-pool
    
    log "✅ خدمة mining-pool مُنشأة"
}

# =====================================================
# إعداد Nginx
# =====================================================

setup_nginx() {
    log "🌐 إعداد Nginx..."
    
    cat > /etc/nginx/sites-available/mining-pool << 'EOF'
# Mining Pool Reverse Proxy
server {
    listen 80;
    server_name _;
    
    # Dashboard
    location / {
        proxy_pass http://127.0.0.1:10000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:10000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
    
    # Stratum Proxy for KAS
    location /stratum/kas {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/mining-pool /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    nginx -t && systemctl reload nginx
    
    log "✅ Nginx مُعد"
}

# =====================================================
# إنشاء سكريبتات الإدارة
# =====================================================

create_management_scripts() {
    log "📜 إنشاء سكريبتات الإدارة..."
    
    # سكريبت البدء
    cat > /usr/local/bin/pool-start << 'EOF'
#!/bin/bash
echo "🚀 بدء حوض التعدين..."
systemctl start mining-pool
systemctl start redis-server
echo "✅ الحوض يعمل!"
EOF
    chmod +x /usr/local/bin/pool-start
    
    # سكريبت الإيقاف
    cat > /usr/local/bin/pool-stop << 'EOF'
#!/bin/bash
echo "🛑 إيقاف حوض التعدين..."
systemctl stop mining-pool
echo "✅ الحوقف متوقف"
EOF
    chmod +x /usr/local/bin/pool-stop
    
    # سكريبت الحالة
    cat > /usr/local/bin/pool-status << 'EOF'
#!/bin/bash
echo "📊 حالة حوض التعدين"
echo "═══════════════════════════════════"
systemctl status mining-pool --no-pager -l
echo ""
echo "═══════════════════════════════════"
curl -s http://localhost:10000/api/health | jq .
EOF
    chmod +x /usr/local/bin/pool-status
    
    # سكريبت السجلات
    cat > /usr/local/bin/pool-logs << 'EOF'
#!/bin/bash
journalctl -u mining-pool -f --no-pager
EOF
    chmod +x /usr/local/bin/pool-logs
    
    # سكريبت التحديث
    cat > /usr/local/bin/pool-update << 'EOF'
#!/bin/bash
echo "🔄 تحديث حوض التعدين..."
cd /opt/mining-pool
git pull origin main
bun install
bun run build
systemctl restart mining-pool
echo "✅ تم التحديث!"
EOF
    chmod +x /usr/local/bin/pool-update
    
    log "✅ سكريبتات الإدارة مُنشأة"
}

# =====================================================
# تشغيل Docker للعقد
# =====================================================

start_docker_nodes() {
    log "🐳 تشغيل العقد الكاملة..."
    
    cd $MINING_DIR/docker
    
    # تشغيل Redis فقط أولاً
    docker compose up -d redis 2>/dev/null || docker-compose up -d redis 2>/dev/null
    
    log ""
    log "⚠️  ل تشغيل العقد الكاملة، نفذ يدوياً:"
    log "   cd $MINING_DIR/docker"
    log "   docker compose up -d"
    log ""
    log "⚠️  العقد تحتاج ساعات للمزامنة!"
    log "   Kaspa: ~50GB | Ravencoin: ~30GB | Alephium: ~20GB"
}

# =====================================================
# الملخص النهائي
# =====================================================

print_summary() {
    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo -e "${GREEN}🎉 تم تثبيت حوض التعدين بنجاح!${NC}"
    echo "══════════════════════════════════════════════════════════════"
    echo ""
    echo "📊 معلومات الحوض:"
    echo "   • Dashboard: http://YOUR_VPS_IP"
    echo "   • API: http://YOUR_VPS_IP/api/health"
    echo "   • Live Stats: http://YOUR_VPS_IP/api/live-stats"
    echo ""
    echo "🔌 منافذ التعدين (Stratum):"
    echo "   • KAS: stratum+tcp://YOUR_VPS_IP:3333"
    echo "   • RVN: stratum+tcp://YOUR_VPS_IP:3334"
    echo "   • ALPH: stratum+tcp://YOUR_VPS_IP:3336"
    echo ""
    echo "📜 أوامر الإدارة:"
    echo "   • pool-start   - بدء الحوض"
    echo "   • pool-stop    - إيقاف الحوض"
    echo "   • pool-status  - حالة الحوض"
    echo "   • pool-logs    - عرض السجلات"
    echo "   • pool-update  - تحديث الحوض"
    echo ""
    echo "⚠️  خطوات مهمة بعد التثبيت:"
    echo "   1. غيّر كلمات المرور في /opt/mining-pool/.env"
    echo "   2. غيّر عناوين المحافظ في .env"
    echo "   3. شغّل العقد الكاملة: cd /opt/mining-pool/docker && docker compose up -d"
    echo "   4. أضف شهادة SSL: certbot --nginx -d your-domain.com"
    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo -e "${YELLOW}⛏️  التعدين يعمل 24/7 تلقائياً!${NC}"
    echo "══════════════════════════════════════════════════════════════"
}

# =====================================================
# الدالة الرئيسية
# =====================================================

main() {
    clear
    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo "⛏️  MultiCoin Mining Pool - VPS Auto-Installer"
    echo "══════════════════════════════════════════════════════════════"
    echo ""
    
    check_root
    check_system
    
    echo ""
    read -p "هل تريد المتابعة؟ (y/n): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "تم الإلغاء."
        exit 1
    fi
    
    install_dependencies
    install_docker
    install_nodejs
    install_redis
    setup_firewall
    clone_project
    create_env_file
    create_systemd_services
    setup_nginx
    create_management_scripts
    start_docker_nodes
    
    # بدء الخدمة
    systemctl start mining-pool
    
    print_summary
}

main "$@"
