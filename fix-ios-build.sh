#!/bin/bash

echo "🔧 Aplicando correções para build iOS..."

# 1. Limpar builds anteriores
echo "1️⃣  Limpando builds anteriores..."
rm -rf ~/Library/Developer/Xcode/DerivedData/APPMOBILEMARCAAI-*
rm -rf ios/build

# 2. Criar arquivo .xcode.env se não existir
echo "2️⃣  Configurando variáveis de ambiente do Xcode..."
cat > ios/.xcode.env << 'EOF'
export NODE_BINARY=node
export SKIP_BUNDLING=0
EOF

# 3. Reinstalar pods
echo "3️⃣  Reinstalando CocoaPods..."
cd ios
export LANG=en_US.UTF-8
pod deintegrate 2>/dev/null || true
pod install

cd ..

echo ""
echo "✅ Correções aplicadas!"
echo ""
echo "📱 Próximos passos:"
echo "   1. Abra o Xcode: open ios/APPMOBILEMARCAAI.xcworkspace"
echo "   2. No Xcode, vá em Product → Scheme → Edit Scheme"
echo "   3. Em Run → Options, DESMARQUE 'Run in Sandbox'"
echo "   4. Faça Clean Build (⇧⌘K) e depois Run (⌘R)"
echo ""

