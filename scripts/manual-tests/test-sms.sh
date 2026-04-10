#!/bin/bash

# SMS.BY Diagnostic Test Script
# Usage: ./scripts/manual-tests/test-sms.sh

echo "🧪 Testing SMS.BY Integration..."
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Server not running on port 3000"
    echo "   Start with: pnpm dev"
    exit 1
fi

echo "✅ Server is running"
echo ""
echo "📞 Calling /api/phone/start..."
echo ""

# Make the request and pretty print JSON
curl -i -X POST http://localhost:3000/api/phone/start 2>/dev/null | tee /tmp/sms-test-response.txt

echo ""
echo ""
echo "📋 Response saved to: /tmp/sms-test-response.txt"
echo ""
echo "💡 Check server console for detailed logs"
echo "💡 Check SMS.BY dashboard: https://app.sms.by/"
