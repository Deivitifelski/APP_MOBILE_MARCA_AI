# Solução para "Upload Symbols Failed - dSYM do Hermes não encontrado"

## 🔍 Problema

Erro ao validar Archive para App Store:
```
Upload Symbols Failed

The archive did not include a dSYM for the hermes.framework with the UUIDs [80D5528F-2C78-3B90-B90F-747E89A9F880]. 
Ensure that the archive's dSYM folder includes a DWARF file for hermes.framework with the expected UUIDs.
```

## 🎯 Causa

O Archive não contém o arquivo dSYM do Hermes, que é necessário para:
- Crash reports detalhados
- Validação do App Store Connect
- Debugging de problemas em produção

## ✅ Solução Completa

### Passo 1: Adicionar Build Phase no Xcode (OBRIGATÓRIO)

**IMPORTANTE:** Você DEVE adicionar manualmente no Xcode:

1. **Abra o projeto**:
   ```bash
   open ios/MarcaAI.xcworkspace
   ```

2. **Selecione o target "MarcaAI"** no navegador de projetos

3. **Vá na aba "Build Phases"**

4. **Clique no botão "+"** no canto superior esquerdo

5. **Selecione "New Run Script Phase"**

6. **Renomeie** o script para: `Copy Hermes dSYM`

7. **Arraste** o script para **ANTES** de "Embed Frameworks" (ou no final, mas antes do último script)

8. **Cole** o seguinte script:

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

# Caminho 1: Pods hermes-engine/destroot
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
    dsymutil "$HERMES_BINARY" -o "${DSYM_DEST}/hermes.framework.dSYM" 2>&1 || true
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

9. **Marque a opção**: **"Run script only when installing"** (IMPORTANTE!)

10. **Salve** o projeto (⌘+S)

### Passo 2: Verificar Build Settings

No **Build Settings**, verifique:

- **Debug Information Format** (Release): `DWARF with dSYM File` ✅
- **Validate Built Product**: `YES` ✅
- **Strip Debug Symbols During Copy** (Release): `YES` ✅

### Passo 3: Limpar e Reinstalar

```bash
# Limpar DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Limpar builds locais
rm -rf ios/build

# Reinstalar Pods
cd ios
pod install
cd ..
```

### Passo 4: Gerar Archive Novamente

1. **No Xcode**:
   - Clean Build Folder: Product → Clean Build Folder (⇧⌘K)
   - Archive: Product → Archive
   - Aguarde o build completar

2. **Validar Archive**:
   - No Organizer, clique em **Distribute App**
   - Selecione **App Store Connect**
   - Siga o assistente
   - O erro não deve mais aparecer

### Passo 5: Verificar se Funcionou

Após o Archive, verifique se o dSYM foi incluído:

```bash
# Listar dSYMs no archive mais recente
ls -la ~/Library/Developer/Xcode/Archives/*/dSYMs/ | grep hermes
```

Você deve ver `hermes.framework.dSYM` na lista.

## 🔍 Troubleshooting

### Se o erro persistir:

1. **Verificar se o Build Phase foi adicionado corretamente**:
   - Build Phases → Deve aparecer "Copy Hermes dSYM"
   - Deve estar marcado "Run script only when installing"

2. **Verificar se o Hermes está instalado**:
   ```bash
   ls -la ios/Pods/hermes-engine/destroot/Library/Frameworks/hermes.framework/
   ```

3. **Verificar logs do build**:
   - No Xcode, Report Navigator (⌘+8)
   - Procure por mensagens do script "Copy Hermes dSYM"
   - Verifique se há erros

4. **Tentar gerar dSYM manualmente**:
   ```bash
   cd ios
   dsymutil Pods/hermes-engine/destroot/Library/Frameworks/hermes.framework/hermes \
     -o ~/hermes.framework.dSYM
   ```

## 💡 Alternativa: Usar Script Externo

Se preferir usar o script externo:

1. O script já está criado em: `scripts/copy-hermes-dsym.sh`

2. No Build Phase, em vez de colar o script, use:
   ```bash
   "${SRCROOT}/../scripts/copy-hermes-dsym.sh"
   ```

## ✅ Checklist

- [ ] Build Phase "Copy Hermes dSYM" adicionado
- [ ] Script colado corretamente
- [ ] "Run script only when installing" marcado
- [ ] Build Settings verificados
- [ ] DerivedData limpo
- [ ] Pods reinstalados
- [ ] Clean Build Folder executado
- [ ] Archive gerado novamente
- [ ] Validação bem-sucedida

## 📋 Notas Importantes

- ⚠️ **O Build Phase DEVE ser adicionado manualmente no Xcode** - não pode ser automatizado via script
- ⚠️ **"Run script only when installing" DEVE estar marcado** - isso garante que o script rode apenas durante Archive
- ⚠️ **O script deve estar ANTES de "Embed Frameworks"** - para garantir que o dSYM seja copiado antes da validação

Após seguir todos os passos, o erro "Upload Symbols Failed" não deve mais aparecer ao validar o Archive.

