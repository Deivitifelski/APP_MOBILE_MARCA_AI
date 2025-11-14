# Como Adicionar Build Phase para Copiar dSYM do Hermes

## Passo a Passo no Xcode

### 1. Abrir o Projeto
```bash
open ios/MarcaAI.xcworkspace
```

### 2. Adicionar Build Phase

1. **Selecione o target "MarcaAI"** no navegador de projetos
2. Vá na aba **"Build Phases"**
3. Clique no botão **"+"** no canto superior esquerdo
4. Selecione **"New Run Script Phase"**

### 3. Configurar o Script

1. **Renomeie** o script para: `Copy Hermes dSYM`
2. **Arraste** o script para **ANTES** de "Embed Frameworks" (ou no final, mas antes do último script)
3. **Cole** o seguinte script:

```bash
# Copiar dSYM do Hermes para o archive
set -e

echo "🔍 Procurando dSYM do Hermes..."

# Caminhos possíveis
HERMES_PATHS=(
  "${PODS_ROOT}/hermes-engine/destroot"
  "${PODS_ROOT}/hermes-engine"
  "${BUILT_PRODUCTS_DIR}/hermes.framework.dSYM"
)

DSYM_FOLDER="${DWARF_DSYM_FOLDER_PATH}"

if [ -z "$DSYM_FOLDER" ]; then
  echo "⚠️ DWARF_DSYM_FOLDER_PATH não definido, usando fallback"
  DSYM_FOLDER="${BUILT_PRODUCTS_DIR}"
fi

mkdir -p "${DSYM_FOLDER}"

# Procurar e copiar dSYM
for SEARCH_PATH in "${HERMES_PATHS[@]}"; do
  if [ -d "$SEARCH_PATH" ]; then
    find "$SEARCH_PATH" -name "*.dSYM" -type d | while read -r DSYM_PATH; do
      DSYM_NAME=$(basename "$DSYM_PATH")
      echo "✅ Encontrado: ${DSYM_NAME}"
      cp -R "$DSYM_PATH" "${DSYM_FOLDER}/"
      echo "✅ Copiado para: ${DSYM_FOLDER}"
    done
  fi
done

# Se não encontrou, tentar gerar do framework
if [ ! -d "${DSYM_FOLDER}/hermes.framework.dSYM" ]; then
  HERMES_FRAMEWORK="${PODS_ROOT}/hermes-engine/destroot/Library/Frameworks/hermes.framework/hermes"
  if [ -f "$HERMES_FRAMEWORK" ] && command -v dsymutil &> /dev/null; then
    echo "🔧 Gerando dSYM do framework..."
    dsymutil "$HERMES_FRAMEWORK" -o "${DSYM_FOLDER}/hermes.framework.dSYM"
    echo "✅ dSYM gerado"
  fi
fi

echo "✅ Processo concluído"
```

### 4. Configurar Opções

1. **Marque** a opção: **"Run script only when installing"** (opcional, mas recomendado)
2. **Desmarque** "Show environment variables in build log" (para logs mais limpos)

### 5. Verificar Build Settings

No **Build Settings**, verifique:

- **Debug Information Format** (Release): `DWARF with dSYM File`
- **Validate Built Product**: `YES`
- **Strip Debug Symbols During Copy** (Release): `YES`

### 6. Reinstalar Pods

```bash
cd ios
pod install
cd ..
```

### 7. Clean e Archive

1. **Clean Build Folder**: ⇧⌘K
2. **Archive**: Product → Archive
3. **Distribute App**: App Store Connect

## Alternativa: Usar Script Externo

Se preferir usar o script externo:

1. Adicione o Build Phase como acima
2. Em vez de colar o script, use:
```bash
"${SRCROOT}/scripts/copy-hermes-dsym.sh"
```

## Verificação

Após o Archive, verifique:
- O dSYM do Hermes deve estar em `~/Library/Developer/Xcode/Archives/.../dSYMs/`
- O erro de validação não deve mais aparecer

## Nota Importante

Se o erro persistir, você pode:
1. **Desabilitar validação temporariamente** (não recomendado):
   - `VALIDATE_PRODUCT = NO` no Build Settings
   
2. **Usar EAS Build** que gerencia isso automaticamente:
   ```bash
   eas build --platform ios --profile production
   ```

