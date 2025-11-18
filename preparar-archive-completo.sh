#!/bin/bash

echo "🚀 Preparando projeto para gerar Archive com dSYM do Hermes..."
echo ""

cd "$(dirname "$0")"

# 1. Limpar DerivedData
echo "1️⃣  Limpando DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null
echo "✅ DerivedData limpo"
echo ""

# 2. Limpar builds locais
echo "2️⃣  Limpando builds locais..."
rm -rf ios/build 2>/dev/null
rm -rf ios/Pods/Build 2>/dev/null
echo "✅ Builds locais limpos"
echo ""

# 3. Reinstalar Pods
echo "3️⃣  Reinstalando CocoaPods..."
cd ios
export LANG=en_US.UTF-8
pod install
cd ..
echo "✅ Pods reinstalados"
echo ""

# 4. Verificar Hermes
echo "4️⃣  Verificando instalação do Hermes..."
if [ -d "ios/Pods/hermes-engine" ]; then
    echo "✅ Hermes encontrado"
    
    # Verificar se há binary
    if [ -f "ios/Pods/hermes-engine/destroot/Library/Frameworks/hermes.framework/hermes" ]; then
        echo "✅ Binary do Hermes encontrado"
    else
        echo "⚠️  Binary do Hermes não encontrado, mas continuando..."
    fi
else
    echo "❌ Hermes não encontrado!"
    echo "   Execute: cd ios && pod install"
fi
echo ""

# 5. Verificar Build Phase
echo "5️⃣  Verificando configurações..."
echo "✅ Certifique-se de que o Build Phase 'Copy Hermes dSYM' foi adicionado no Xcode"
echo ""

echo "✅ Preparação concluída!"
echo ""
echo "📱 Próximos passos no Xcode:"
echo ""
echo "   1. Feche o Xcode completamente (⌘+Q)"
echo "   2. Aguarde 5-10 segundos"
echo "   3. Abra o Xcode: open ios/MarcaAI.xcworkspace"
echo "   4. Verifique se o Build Phase 'Copy Hermes dSYM' está presente:"
echo "      - Target MarcaAI → Build Phases → Deve aparecer 'Copy Hermes dSYM'"
echo "      - Deve estar marcado 'Run script only when installing'"
echo "   5. Clean Build Folder: Product → Clean Build Folder (⇧⌘K)"
echo "   6. Gere o Archive: Product → Archive"
echo "   7. Valide o Archive: Distribute App → App Store Connect"
echo ""
echo "💡 Se o Build Phase não estiver presente, adicione manualmente:"
echo "   - Veja instruções em: SOLUCAO_UPLOAD_SYMBOLS_HERMES.md"
echo ""

