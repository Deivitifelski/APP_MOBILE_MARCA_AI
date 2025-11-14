#!/bin/bash

echo "🔧 Corrigindo problema de dSYM do Hermes..."

# 1. Limpar DerivedData
echo "1️⃣  Limpando DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 2. Limpar build do iOS
echo "2️⃣  Limpando build do iOS..."
rm -rf ios/build

# 3. Limpar Pods e reinstalar
echo "3️⃣  Reinstalando CocoaPods..."
cd ios
pod deintegrate 2>/dev/null || true
pod cache clean --all 2>/dev/null || true
pod install

cd ..

# 4. Limpar cache do CocoaPods
echo "4️⃣  Limpando cache do CocoaPods..."
rm -rf ~/Library/Caches/CocoaPods

# 5. Verificar se há configurações de dSYM no projeto
echo "5️⃣  Verificando configurações do projeto..."

echo ""
echo "✅ Limpeza concluída!"
echo ""
echo "📱 Próximos passos no Xcode:"
echo "   1. Abra o projeto: open ios/MarcaAI.xcworkspace"
echo "   2. Selecione o target 'MarcaAI'"
echo "   3. Vá em Build Settings"
echo "   4. Procure por 'Debug Information Format'"
echo "   5. Para Debug: defina como 'DWARF'"
echo "   6. Para Release: defina como 'DWARF with dSYM File'"
echo "   7. Procure por 'Strip Debug Symbols During Copy'"
echo "   8. Defina como 'NO' para Debug e 'YES' para Release"
echo "   9. Faça Clean Build Folder (⇧⌘K)"
echo "  10. Tente compilar novamente (⌘R)"
echo ""
echo "💡 Se o erro persistir, você pode desabilitar a validação de dSYM:"
echo "   - Vá em Build Settings → 'Validate Built Product' → defina como 'NO'"
echo ""

