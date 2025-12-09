#!/bin/bash

echo "🚀 Testing local production build..."

# Build the project
echo "📦 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

# Start server in background
echo "🌐 Starting server..."
npm start &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Test health endpoint
echo "🏥 Testing health endpoint..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health || echo "000")

if [ "$HEALTH_CHECK" = "200" ] || [ "$HEALTH_CHECK" = "404" ]; then
    echo "✅ Server is responding!"
else
    echo "❌ Server health check failed (HTTP: $HEALTH_CHECK)"
fi

# Kill the server
kill $SERVER_PID 2>/dev/null

echo "🎉 Local test complete!"