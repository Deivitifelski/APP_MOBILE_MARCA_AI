#!/bin/bash
# Limpeza completa do projeto iOS (DerivedData, Pods, build, cache)
# Use quando houver erros de build, "module not found" ou falta de memória.

set -e
cd "$(dirname "$0")"
PROJECT_ROOT="$(cd .. && pwd)"

echo "🧹 Limpando DerivedData do Xcode (MarcaAI)..."
rm -rf ~/Library/Developer/Xcode/DerivedData/MarcaAI-* 2>/dev/null || true

echo "🧹 Limpando build e Pods no ios/..."
rm -rf build Pods Podfile.lock

echo "🧹 Limpando cache do CocoaPods..."
rm -rf ~/Library/Caches/CocoaPods 2>/dev/null || true

echo "🧹 Limpando cache Metro/Expo..."
rm -rf "$PROJECT_ROOT/node_modules/.cache" "$PROJECT_ROOT/.expo" 2>/dev/null || true

echo "✅ Limpeza concluída."
echo ""
echo "Próximos passos:"
echo "  1. cd ios && pod install"
echo "  2. Abrir: open MarcaAI.xcworkspace"
echo "  3. No Xcode: Product → Clean Build Folder (⇧⌘K)"
echo "  4. Product → Run (⌘R)"
