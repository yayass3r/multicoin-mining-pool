-- =====================================================
-- قاعدة بيانات حوض التعدين متعدد العملات
-- Multi-Coin Mining Pool Database Schema
-- =====================================================

-- إنشاء قاعدة البيانات
CREATE DATABASE IF NOT EXISTS mining_pool;

-- الاتصال بقاعدة البيانات
\c mining_pool;

-- =====================================================
-- جدول المعدنين
-- =====================================================
CREATE TABLE IF NOT EXISTS miners (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(255) NOT NULL,
    worker_name VARCHAR(100) DEFAULT 'worker1',
    coin VARCHAR(10) NOT NULL,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP,
    is_connected BOOLEAN DEFAULT true,
    total_shares BIGINT DEFAULT 0,
    invalid_shares BIGINT DEFAULT 0,
    total_hashrate BIGINT DEFAULT 0,
    last_share_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_address, worker_name, coin)
);

-- =====================================================
-- جدول الشيرات
-- =====================================================
CREATE TABLE IF NOT EXISTS shares (
    id BIGSERIAL PRIMARY KEY,
    miner_id INTEGER REFERENCES miners(id),
    wallet_address VARCHAR(255) NOT NULL,
    worker_name VARCHAR(100),
    coin VARCHAR(10) NOT NULL,
    job_id VARCHAR(50),
    nonce VARCHAR(255),
    difficulty DECIMAL(20, 8) NOT NULL,
    is_valid BOOLEAN DEFAULT true,
    is_block BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- جدول الكتل
-- =====================================================
CREATE TABLE IF NOT EXISTS blocks (
    id SERIAL PRIMARY KEY,
    coin VARCHAR(10) NOT NULL,
    block_height BIGINT NOT NULL,
    block_hash VARCHAR(255),
    miner_wallet VARCHAR(255) NOT NULL,
    worker_name VARCHAR(100),
    reward DECIMAL(20, 8) NOT NULL,
    difficulty DECIMAL(20, 8),
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, orphaned
    confirmed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coin, block_height)
);

-- =====================================================
-- جدول الأرصدة
-- =====================================================
CREATE TABLE IF NOT EXISTS balances (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(255) NOT NULL,
    coin VARCHAR(10) NOT NULL,
    balance DECIMAL(20, 8) DEFAULT 0,
    total_earned DECIMAL(20, 8) DEFAULT 0,
    total_paid DECIMAL(20, 8) DEFAULT 0,
    last_payout_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_address, coin)
);

-- =====================================================
-- جدول المدفوعات
-- =====================================================
CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(255) NOT NULL,
    coin VARCHAR(10) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    tx_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- =====================================================
-- جدول إعدادات الحوض
-- =====================================================
CREATE TABLE IF NOT EXISTS pool_settings (
    id SERIAL PRIMARY KEY,
    coin VARCHAR(10) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    difficulty DECIMAL(20, 8),
    min_payout DECIMAL(20, 8),
    pool_fee DECIMAL(5, 2) DEFAULT 1.0,
    stratum_port INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- إدراج الإعدادات الافتراضية
INSERT INTO pool_settings (coin, enabled, difficulty, min_payout, pool_fee, stratum_port) VALUES
('KAS', true, 16384, 100, 1.0, 3333),
('RVN', true, 0.5, 10, 1.0, 3334),
('ZEPH', true, 50000, 0.1, 1.0, 3335),
('ALPH', true, 1000, 1, 1.0, 3336)
ON CONFLICT (coin) DO NOTHING;

-- =====================================================
-- جدول إحصائيات الشبكة
-- =====================================================
CREATE TABLE IF NOT EXISTS network_stats (
    id SERIAL PRIMARY KEY,
    coin VARCHAR(10) NOT NULL,
    block_height BIGINT,
    difficulty DECIMAL(20, 8),
    network_hashrate DECIMAL(20, 8),
    block_reward DECIMAL(20, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- جدول سجلات النظام
-- =====================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL, -- info, warning, error
    component VARCHAR(50),
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- الفهارس (Indexes)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_miners_wallet ON miners(wallet_address);
CREATE INDEX IF NOT EXISTS idx_miners_coin ON miners(coin);
CREATE INDEX IF NOT EXISTS idx_shares_miner ON shares(miner_id);
CREATE INDEX IF NOT EXISTS idx_shares_coin ON shares(coin);
CREATE INDEX IF NOT EXISTS idx_shares_created ON shares(created_at);
CREATE INDEX IF NOT EXISTS idx_blocks_coin ON blocks(coin);
CREATE INDEX IF NOT EXISTS idx_blocks_status ON blocks(status);
CREATE INDEX IF NOT EXISTS idx_balances_wallet ON balances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payouts_wallet ON payouts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- =====================================================
-- الدوال (Functions)
-- =====================================================

-- دالة تحديث الرصيد
CREATE OR REPLACE FUNCTION update_miner_balance(
    p_wallet VARCHAR(255),
    p_coin VARCHAR(10),
    p_amount DECIMAL(20, 8)
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO balances (wallet_address, coin, balance, total_earned)
    VALUES (p_wallet, p_coin, p_amount, p_amount)
    ON CONFLICT (wallet_address, coin)
    DO UPDATE SET
        balance = balances.balance + p_amount,
        total_earned = balances.total_earned + p_amount,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- دالة الحصول على إحصائيات المعدن
CREATE OR REPLACE FUNCTION get_miner_stats(
    p_wallet VARCHAR(255),
    p_coin VARCHAR(10) DEFAULT NULL
)
RETURNS TABLE (
    coin VARCHAR,
    balance DECIMAL,
    total_earned DECIMAL,
    total_paid DECIMAL,
    workers BIGINT,
    hashrate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.coin,
        b.balance,
        b.total_earned,
        b.total_paid,
        COUNT(DISTINCT m.worker_name) as workers,
        COALESCE(SUM(m.total_hashrate), 0) as hashrate
    FROM balances b
    LEFT JOIN miners m ON m.wallet_address = b.wallet_address AND m.coin = b.coin
    WHERE b.wallet_address = p_wallet
      AND (p_coin IS NULL OR b.coin = p_coin)
    GROUP BY b.coin, b.balance, b.total_earned, b.total_paid;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- المشغلات (Triggers)
-- =====================================================

-- تحديث timestamp تلقائياً
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_miners_timestamp
    BEFORE UPDATE ON miners
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_balances_timestamp
    BEFORE UPDATE ON balances
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- المستخدمون والصلاحيات
-- =====================================================

-- إنشاء مستخدم قاعدة البيانات
-- CREATE USER pool_user WITH PASSWORD 'your_secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE mining_pool TO pool_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pool_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pool_user;

-- =====================================================
-- بيانات اختبارية (اختياري)
-- =====================================================

-- إدراج معدنين اختباريين
-- INSERT INTO miners (wallet_address, worker_name, coin, is_connected, total_shares, total_hashrate)
-- VALUES
--     ('kaspa:test123', 'worker1', 'KAS', true, 1000, 500000000),
--     ('kaspa:test123', 'worker2', 'KAS', true, 800, 400000000);

-- =====================================================
-- نهاية الملف
-- =====================================================
