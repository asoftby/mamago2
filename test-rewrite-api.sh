#!/bin/bash

# Test AI Rewrite API
# Usage: ./test-rewrite-api.sh

echo "🧪 Testing AI Rewrite API..."
echo ""

# Get session cookie (you need to be logged in)
# Replace with your actual session cookie from browser
COOKIE="your-session-cookie-here"

curl -v -X POST "http://localhost:3000/api/ai/rewrite" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d '{
    "tone": "neutral",
    "sourceText": "Это тестовый текст для проверки AI rewrite функциональности. Текст должен быть переписан в нейтральном тоне.",
    "title": "Тестовое событие",
    "entityType": "event"
  }' 2>&1

echo ""
echo "✅ Test completed"
