# Solução Definitiva para dSYM do Hermes e RCTFatal

## Problema
- Erro: "The archive did not include a dSYM for the hermes.framework"
- Crash: "MarcaAI: RCTFatal + 568"

## Solução Completa

### 1. Adicionar Build Phase no Xcode (OBRIGATÓRIO)

**IMPORTANTE:** Você DEVE adicionar manualmente no Xcode:

1. Abra: `open ios/MarcaAI.xcworkspace`
2. Selecione target **MarcaAI**
3. Vá em **Build Phases**
4. Clique **"+"** → **"New Run Script Phase"**
5. **Renomeie** para: `Copy Hermes dSYM`
6. **Arraste** para **ANTES** de "Embed Frameworks"
7. **Cole** este script:

```bash
#!/bin/bash
set -e

echo "🔍 [Copy Hermes dSYM] Iniciando..."

DSYM_DEST="${DWARF_DSYM_FOLDER_PATH}"
if [ -z "$DSYM_DEST" ]; then
  DSYM_DEST="${BUILT_PRODUCTS_DIR}"
fi

mkdir -p "${DSYM_DEST}"

# Procurar dSYM do Hermes
HERMES_DSYM_FOUND=0

# Caminho 1: Pods hermes-engine
if [ -d "${PODS_ROOT}/hermes-engine/destroot" ]; then
  find "${PODS_ROOT}/hermes-engine/destroot" -name "hermes.framework.dSYM" -type d | while read -r DSYM; do
    echo "✅ [Copy Hermes dSYM] Encontrado em destroot: $DSYM"
    cp -R "$DSYM" "${DSYM_DEST}/"
    HERMES_DSYM_FOUND=1
  done
fi

# Caminho 2: Procurar em todo hermes-engine
if [ $HERMES_DSYM_FOUND -eq 0 ] && [ -d "${PODS_ROOT}/hermes-engine" ]; then
  find "${PODS_ROOT}/hermes-engine" -name "*.dSYM" -type d | while read -r DSYM; do
    echo "✅ [Copy Hermes dSYM] Encontrado: $DSYM"
    cp -R "$DSYM" "${DSYM_DEST}/"
    HERMES_DSYM_FOUND=1
  done
fi

# Caminho 3: Gerar dSYM do framework se não encontrou
if [ $HERMES_DSYM_FOUND -eq 0 ]; then
  HERMES_BINARY="${PODS_ROOT}/hermes-engine/destroot/Library/Frameworks/hermes.framework/hermes"
  if [ -f "$HERMES_BINARY" ] && command -v dsymutil &> /dev/null; then
    echo "🔧 [Copy Hermes dSYM] Gerando dSYM do binary..."
    dsymutil "$HERMES_BINARY" -o "${DSYM_DEST}/hermes.framework.dSYM" 2>&1
    if [ -d "${DSYM_DEST}/hermes.framework.dSYM" ]; then
      echo "✅ [Copy Hermes dSYM] dSYM gerado com sucesso"
      HERMES_DSYM_FOUND=1
    fi
  fi
fi

if [ $HERMES_DSYM_FOUND -eq 0 ]; then
  echo "⚠️ [Copy Hermes dSYM] AVISO: dSYM do Hermes não encontrado/gerado"
  echo "⚠️ Isso pode causar erro na validação do App Store"
else
  echo "✅ [Copy Hermes dSYM] Concluído com sucesso"
fi
```

8. **Marque**: "Run script only when installing" (IMPORTANTE!)
9. **Salve** o projeto

### 2. Verificar Build Settings

No **Build Settings**, verifique:

- **Debug Information Format** (Release): `DWARF with dSYM File` ✅
- **Validate Built Product**: `YES` ✅
- **Strip Debug Symbols During Copy** (Release): `YES` ✅

### 3. Reinstalar Pods

```bash
cd ios
pod install
cd ..
```

### 4. Clean e Archive

```bash
# No Xcode:
# 1. Clean Build Folder (⇧⌘K)
# 2. Product → Archive
# 3. Distribute App → App Store Connect
```

### 5. Verificar se Funcionou

Após o Archive, verifique:

```bash
# Listar dSYMs no archive
ls -la ~/Library/Developer/Xcode/Archives/*/dSYMs/
```

Você deve ver `hermes.framework.dSYM` na lista.

## Solução Alternativa: Desabilitar Validação (NÃO RECOMENDADO)

Se ainda não funcionar, você pode desabilitar a validação temporariamente:

1. No Xcode, **Build Settings**
2. Procure: **Validate Built Product**
3. Defina como: **NO**

⚠️ **ATENÇÃO:** Isso desabilita a validação de dSYM, mas o app ainda funcionará. Porém, você não terá crash reports detalhados do Hermes.

## Sobre o Crash RCTFatal

O crash `RCTFatal + 568` indica um erro JavaScript fatal. As correções já implementadas devem ajudar:

1. ✅ Error Boundary (captura erros React)
2. ✅ Handler global de erros JavaScript
3. ✅ Handler de exceções no AppDelegate

## Verificação Final

Após adicionar o Build Phase e fazer o Archive:

1. ✅ O erro de dSYM não deve mais aparecer
2. ✅ O crash RCTFatal deve ser capturado pelo Error Boundary
3. ✅ O app deve funcionar normalmente

## Se Ainda Não Funcionar

Use **EAS Build** que gerencia isso automaticamente:

```bash
npm install -g eas-cli
eas build:configure
eas build --platform ios --profile production
```

