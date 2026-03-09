#!/bin/bash
# =====================================================
# 🚂 Railway Deployment Script
# =====================================================

RAILWAY_TOKEN="f7d98565-d01e-44fd-a718-605db9e74712"
PROJECT_ID="956f711b-4e1c-4e0f-b0c8-2d3b29c6fff1"
SERVICE_ID="653b63fe-9411-4f8a-8716-472d56e0b021"
ENV_ID="ac7f7b5c-1269-43f5-9385-437f08f53b6d"

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "🚂 Railway Mining Pool Deployment"
echo "══════════════════════════════════════════════════════════════════"
echo ""

# تحديث source إلى GitHub repo
echo "📦 ربط المستودع..."

curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { serviceSourceUpdate(input: { serviceId: \"'${SERVICE_ID}'\", source: { repo: \"https://github.com/yayass3r/multicoin-mining-pool\", branch: \"main\" } }) }"
  }' 2>&1

echo ""
echo "✅ تم التحديث!"
echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "📋 معلومات النشر:"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Railway Dashboard:"
echo "   https://railway.app/project/${PROJECT_ID}"
echo ""
echo "📊 متغيرات البيئة المضافة:"
echo "   ✅ NODE_ENV=production"
echo "   ✅ PORT=10000"
echo "   ✅ KAS_WALLET=kaspa:qppxt0expwdg4vra08709anc..."
echo "   ✅ RVN_WALLET=REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y"
echo "   ✅ ALPH_WALLET=1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b"
echo ""
echo "══════════════════════════════════════════════════════════════════"
