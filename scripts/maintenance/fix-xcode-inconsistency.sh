#!/bin/bash

echo "🔧 Corrigindo erro de inconsistência interna do Xcode..."

# 1. Limpar DerivedData
echo "1️⃣  Limpando DerivedData do Xcode..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 2. Limpar build do projeto
echo "2️⃣  Limpando builds do projeto..."
rm -rf ios/build
rm -rf ios/Pods/Build

# 3. Limpar user data do Xcode
echo "3️⃣  Limpando dados do usuário do Xcode..."
rm -rf ios/MarcaAI.xcworkspace/xcuserdata
rm -rf ios/MarcaAI.xcodeproj/xcuserdata
rm -rf ios/MarcaAI.xcworkspace/xcshareddata

# 4. Limpar Pods e reinstalar
echo "4️⃣  Removendo Pods antigos..."
rm -rf ios/Pods
rm -f ios/Podfile.lock

# 5. Limpar cache do CocoaPods
echo "5️⃣  Limpando cache do CocoaPods..."
export LANG=en_US.UTF-8
cd ios
pod cache clean --all 2>/dev/null || true

# 6. Reinstalar Pods
echo "6️⃣  Reinstalando Pods..."
pod install --repo-update

cd ..

echo ""
echo "✅ Limpeza completa!"
echo ""
echo "📱 Próximos passos:"
echo "   1. Feche o Xcode completamente (⌘Q)"
echo "   2. Abra o projeto: open ios/MarcaAI.xcworkspace"
echo "   3. No Xcode: Product → Clean Build Folder (⇧⌘K)"
echo "   4. Feche e abra o Xcode novamente"
echo "   5. Tente fazer o build novamente"
echo ""

