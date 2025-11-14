#!/bin/bash

echo "🔧 Corrigindo dSYM do Hermes para App Store..."

# 1. Limpar tudo
echo "1️⃣  Limpando builds e caches..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ios/build
rm -rf ios/Pods/Build

# 2. Reinstalar Pods com as novas configurações
echo "2️⃣  Reinstalando CocoaPods com configurações de dSYM..."
cd ios
pod install
cd ..

echo ""
echo "✅ Configurações aplicadas!"
echo ""
echo "📱 Próximos passos:"
echo ""
echo "1. Abra o projeto:"
echo "   open ios/MarcaAI.xcworkspace"
echo ""
echo "2. No Xcode, selecione o target 'MarcaAI'"
echo ""
echo "3. Vá em Build Settings e verifique:"
echo "   - Debug Information Format (Release): 'DWARF with dSYM File'"
echo "   - Validate Built Product: 'YES'"
echo ""
echo "4. Vá em Build Phases e adicione um novo 'Run Script Phase' (se não existir):"
echo "   Nome: 'Copy Hermes dSYM'"
echo "   Script:"
echo "   if [ -d \"\${PODS_ROOT}/hermes-engine/destroot\" ]; then"
echo "     find \"\${PODS_ROOT}/hermes-engine/destroot\" -name \"*.dSYM\" -exec cp -R {} \"\${DWARF_DSYM_FOLDER_PATH}\" \\;"
echo "   fi"
echo ""
echo "5. Faça Clean Build Folder (⇧⌘K)"
echo ""
echo "6. Archive o projeto (Product → Archive)"
echo ""
echo "7. Faça upload para App Store Connect"
echo ""

