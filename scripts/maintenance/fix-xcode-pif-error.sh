#!/bin/bash

echo "🔧 Corrigindo erro PIF do Xcode..."

# 1. Finalizar todos os processos do Xcode
echo "1️⃣  Finalizando processos do Xcode..."
killall Xcode 2>/dev/null
killall com.apple.CoreSimulator.CoreSimulatorService 2>/dev/null
sleep 2

# 2. Limpar DerivedData
echo "2️⃣  Limpando DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null

# 3. Limpar arquivos de lock
echo "3️⃣  Removendo arquivos de lock..."
find ~/Library/Developer/Xcode/DerivedData -name "*.lock" -delete 2>/dev/null

# 4. Limpar build local
echo "4️⃣  Limpando builds locais..."
cd "$(dirname "$0")"
rm -rf ios/build ios/Pods/build 2>/dev/null

# 5. Limpar arquivos de usuário do Xcode
echo "5️⃣  Limpando arquivos de usuário..."
cd ios
find . -name "*.pbxuser" -o -name "*.perspectivev3" -o -name "*.xcuserstate" 2>/dev/null | xargs rm -f 2>/dev/null
rm -rf *.xcworkspace/xcuserdata *.xcodeproj/xcuserdata 2>/dev/null

cd ..

echo ""
echo "✅ Limpeza concluída!"
echo ""
echo "📱 Próximos passos:"
echo "   1. Aguarde 5-10 segundos"
echo "   2. Abra o Xcode: open ios/MarcaAI.xcworkspace"
echo "   3. No Xcode, vá em Product → Clean Build Folder (⇧⌘K)"
echo "   4. Feche e reabra o Xcode"
echo "   5. Tente compilar novamente (⌘R)"
echo ""

