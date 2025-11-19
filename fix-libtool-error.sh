#!/bin/bash

echo "🔧 Corrigindo erro 'Command Libtool failed with a nonzero exit code'..."
echo ""

# 1. Limpar DerivedData
echo "1️⃣  Limpando DerivedData do Xcode..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 2. Limpar builds locais
echo "2️⃣  Limpando builds locais..."
rm -rf ios/build
rm -rf ios/Pods/build

# 3. Limpar cache do CocoaPods
echo "3️⃣  Limpando cache do CocoaPods..."
rm -rf ~/Library/Caches/CocoaPods

# 4. Reinstalar pods
echo "4️⃣  Reinstalando CocoaPods..."
cd ios
export LANG=en_US.UTF-8
pod deintegrate 2>/dev/null || true
pod install

cd ..

echo ""
echo "✅ Correções aplicadas!"
echo ""
echo "📱 Próximos passos no Xcode:"
echo "   1. Feche o Xcode completamente"
echo "   2. Abra novamente: open ios/MarcaAI.xcworkspace"
echo "   3. No Xcode, vá em Product → Clean Build Folder (⇧⌘K)"
echo "   4. Aguarde alguns segundos"
echo "   5. Tente compilar novamente (⌘R)"
echo ""
echo "💡 Se o erro persistir, tente também:"
echo "   - Xcode → Preferences → Locations → Derived Data → Delete"
echo "   - Reinicie o Xcode"
echo ""


