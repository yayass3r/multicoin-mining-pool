#!/bin/bash

# =====================================================
# ⛓️ Kaspa Full Node Installation Script
# =====================================================
# 
# هذا السكريبت يقوم بتحميل وتثبيت Kaspa Full Node
# على سيرفر Linux وتشغيله للاتصال بالشبكة الرئيسية
#
# @author Senior Blockchain Protocol Engineer
# =====================================================

set -e

echo "================================================"
echo "⛓️  Kaspa Full Node - التثبيت والتشغيل"
echo "================================================"

# =====================================================
# المتغيرات
# =====================================================
KASPA_VERSION="v0.13.4"
KASPA_DIR="/opt/kaspa"
KASPA_DATA_DIR="/var/lib/kaspa"
KASPA_USER="kaspa"
KASPA_RPC_PORT=16110
KASPA_LISTEN_PORT=16111

# =====================================================
# 1️⃣ التحقق من المتطلبات
# =====================================================
echo ""
echo "📦 التحقق من المتطلبات..."

# التحقق من أننا root
if [ "$EUID" -ne 0 ]; then
    echo "❌ يرجى تشغيل السكريبت كـ root أو باستخدام sudo"
    exit 1
fi

# التحقق من النظام
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ لا يمكن تحديد نظام التشغيل"
    exit 1
fi

echo "✅ نظام التشغيل: $OS"

# =====================================================
# 2️⃣ تثبيت التبعيات
# =====================================================
echo ""
echo "📦 تثبيت التبعيات..."

case $OS in
    ubuntu|debian)
        apt-get update
        apt-get install -y wget curl jq unzip
        ;;
    centos|rhel)
        yum install -y wget curl jq unzip
        ;;
    *)
        echo "⚠️ نظام غير مدعوم تلقائياً، يرجى تثبيت wget, curl, jq, unzip يدوياً"
        ;;
esac

echo "✅ تم تثبيت التبعيات"

# =====================================================
# 3️⃣ إنشاء المستخدم والمجلدات
# =====================================================
echo ""
echo "📁 إنشاء المجلدات..."

# إنشاء مستخدم kaspa
if ! id -u $KASPA_USER >/dev/null 2>&1; then
    useradd -r -s /bin/false $KASPA_USER
    echo "✅ تم إنشاء المستخدم: $KASPA_USER"
fi

# إنشاء المجلدات
mkdir -p $KASPA_DIR
mkdir -p $KASPA_DATA_DIR
mkdir -p $KASPA_DATA_DIR/logs

echo "✅ تم إنشاء المجلدات"

# =====================================================
# 4️⃣ تحميل Kaspa Node
# =====================================================
echo ""
echo "⬇️ تحميل Kaspa Node $KASPA_VERSION..."

# تحديد البنية
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        KASPA_ARCH="amd64"
        ;;
    aarch64)
        KASPA_ARCH="arm64"
        ;;
    *)
        echo "❌ بنية غير مدعومة: $ARCH"
        exit 1
        ;;
esac

# تحميل الرابط الصحيح
DOWNLOAD_URL="https://github.com/kaspanet/kaspad/releases/download/${KASPA_VERSION}/kaspad-${KASPA_VERSION}-linux-${KASPA_ARCH}.zip"

echo "📥 الرابط: $DOWNLOAD_URL"

# تحميل الملف
cd /tmp
wget -q --show-progress $DOWNLOAD_URL -O kaspa.zip

# فك الضغط
unzip -o kaspa.zip -d $KASPA_DIR

# إعطاء الصلاحيات
chmod +x $KASPA_DIR/kaspad
chmod +x $KASPA_DIR/kaspaminer

echo "✅ تم تحميل Kaspa Node"

# =====================================================
# 5️⃣ إنشاء ملف الإعدادات
# =====================================================
echo ""
echo "⚙️ إنشاء ملف الإعدادات..."

cat > $KASPA_DIR/kaspad.conf << EOF
# =====================================================
# Kaspa Node Configuration
# =====================================================

# الشبكة
network=mainnet

# RPC
rpclisten=127.0.0.1:$KASPA_RPC_PORT
rpcuser=kaspa_rpc
rpcpass=$(openssl rand -base64 32)

# P2P
listen=:$KASPA_LISTEN_PORT

# أداء
maxpeers=125
syncmode=full

# سجلات
logdir=$KASPA_DATA_DIR/logs
loglevel=info

# البيانات
datadir=$KASPA_DATA_DIR

# التعدين (اختياري - للحوض فقط)
miningaddr=kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86
EOF

echo "✅ تم إنشاء ملف الإعدادات"

# =====================================================
# 6️⃣ إنشاء Systemd Service
# =====================================================
echo ""
echo "🔧 إنشاء خدمة النظام..."

cat > /etc/systemd/system/kaspad.service << EOF
[Unit]
Description=Kaspa Full Node
After=network.target

[Service]
Type=simple
User=$KASPA_USER
Group=$KASPA_USER
ExecStart=$KASPA_DIR/kaspad --configfile=$KASPA_DIR/kaspad.conf
Restart=on-failure
RestartSec=30
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# تفعيل الخدمة
systemctl daemon-reload
systemctl enable kaspad

echo "✅ تم إنشاء خدمة النظام"

# =====================================================
# 7️⃣ بدء التشغيل
# =====================================================
echo ""
echo "🚀 بدء تشغيل Kaspa Node..."

chown -R $KASPA_USER:$KASPA_USER $KASPA_DIR
chown -R $KASPA_USER:$KASPA_USER $KASPA_DATA_DIR

systemctl start kaspad

echo ""
echo "⏳ في انتظار بدء الخدمة..."
sleep 5

# =====================================================
# 8️⃣ التحقق من الحالة
# =====================================================
echo ""
echo "📊 التحقق من الحالة..."

if systemctl is-active --quiet kaspad; then
    echo "✅ Kaspa Node يعمل بنجاح!"
    echo ""
    echo "================================================"
    echo "📋 معلومات الاتصال:"
    echo "================================================"
    echo "🌐 RPC Address: 127.0.0.1:$KASPA_RPC_PORT"
    echo "📡 P2P Port: $KASPA_LISTEN_PORT"
    echo "📁 Data Dir: $KASPA_DATA_DIR"
    echo "⚙️ Config: $KASPA_DIR/kaspad.conf"
    echo ""
    echo "📋 أوامر مفيدة:"
    echo "  • الحالة: systemctl status kaspad"
    echo "  • السجلات: journalctl -u kaspad -f"
    echo "  • إيقاف: systemctl stop kaspad"
    echo "  • إعادة: systemctl restart kaspad"
    echo "================================================"
else
    echo "❌ فشل بدء التشغيل!"
    echo "تحقق من السجلات: journalctl -u kaspad -n 50"
    exit 1
fi

# =====================================================
# 9️⃣ انتظار المزامنة
# =====================================================
echo ""
echo "⏳ المزامنة مع الشبكة قد تستغرق عدة ساعات..."
echo "📊 يمكنك مراقبة التقدم باستخدام:"
echo "   watch -n 5 'curl -s 127.0.0.1:$KASPA_RPC_PORT/api/v1/info | jq .'"

# تنظيف
rm -f /tmp/kaspa.zip

echo ""
echo "✅ اكتمل التثبيت بنجاح!"
