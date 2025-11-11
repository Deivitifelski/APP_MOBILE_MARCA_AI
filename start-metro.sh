#!/bin/bash

# Script para iniciar o Metro Bundler corretamente antes de compilar no Xcode

echo "🚀 Iniciando Metro Bundler..."

# Limpar cache
echo "🧹 Limpando cache..."
rm -rf /tmp/metro-* 2>/dev/null
rm -rf /tmp/haste-map-* 2>/dev/null

# Matar processos existentes do Metro
echo "🔄 Finalizando instâncias anteriores do Metro..."
lsof -ti:8081 | xargs kill -9 2>/dev/null

# Iniciar Metro em background
echo "▶️  Iniciando Metro na porta 8081..."
npx expo start --clear --port 8081 &

# Aguardar Metro inicializar
echo "⏳ Aguardando Metro inicializar..."
sleep 5

echo "✅ Metro Bundler pronto!"
echo "📱 Agora você pode compilar no Xcode (⌘R)"
echo ""
echo "Para parar o Metro: Ctrl+C ou 'killall node'"

