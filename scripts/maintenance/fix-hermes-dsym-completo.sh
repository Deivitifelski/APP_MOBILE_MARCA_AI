#!/bin/bash

echo "🔧 Corrigindo problema de dSYM do Hermes (solução completa)..."

# 1. Limpar tudo
echo "1️⃣  Limpando builds e caches..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ios/build
rm -rf ios/Pods
rm -rf ~/Library/Caches/CocoaPods

# 2. Reinstalar Pods
echo "2️⃣  Reinstalando CocoaPods..."
cd ios
pod install --repo-update
cd ..

echo ""
echo "✅ Limpeza e reinstalação concluídas!"
echo ""
echo "📱 IMPORTANTE - Configure no Xcode:"
echo ""
echo "1. Abra o projeto:"
echo "   open ios/MarcaAI.xcworkspace"
echo ""
echo "2. No Xcode, selecione o target 'MarcaAI'"
echo ""
echo "3. Vá em Build Settings e configure:"
echo ""
echo "   a) Procure por 'Debug Information Format':"
echo "      - Debug: 'DWARF'"
echo "      - Release: 'DWARF with dSYM File'"
echo ""
echo "   b) Procure por 'Strip Debug Symbols During Copy':"
echo "      - Debug: 'NO'"
echo "      - Release: 'YES'"
echo ""
echo "   c) Procure por 'Validate Built Product':"
echo "      - Defina como 'NO' (isso desabilita a validação de dSYM)"
echo ""
echo "   d) Procure por 'Copy Pods Resources' ou 'Embed Frameworks':"
echo "      - Certifique-se de que está configurado corretamente"
echo ""
echo "4. Faça Clean Build Folder (⇧⌘K)"
echo ""
echo "5. Tente compilar novamente (⌘R)"
echo ""
echo "💡 Se ainda der erro, você pode tentar:"
echo "   - Desabilitar Hermes temporariamente (não recomendado)"
echo "   - Ou ignorar o warning se não afetar o funcionamento do app"
echo ""

