#!/bin/bash
# Script para copiar dSYM do Hermes para o archive
# Este script deve ser adicionado como Build Phase no Xcode

set -e

echo "🔍 [Copy Hermes dSYM] Iniciando..."

# Determinar destino do dSYM
DSYM_DEST="${DWARF_DSYM_FOLDER_PATH}"
if [ -z "$DSYM_DEST" ]; then
  DSYM_DEST="${BUILT_PRODUCTS_DIR}"
fi

mkdir -p "${DSYM_DEST}"

# Procurar dSYM do Hermes
HERMES_DSYM_FOUND=0

# Caminho 1: Pods hermes-engine/destroot (mais comum)
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
    else
      echo "⚠️ [Copy Hermes dSYM] Falha ao gerar dSYM"
    fi
  fi
fi

# Caminho 4: Verificar se já existe no destino
if [ $HERMES_DSYM_FOUND -eq 0 ] && [ -d "${DSYM_DEST}/hermes.framework.dSYM" ]; then
  echo "✅ [Copy Hermes dSYM] dSYM já existe no destino"
  HERMES_DSYM_FOUND=1
fi

if [ $HERMES_DSYM_FOUND -eq 0 ]; then
  echo "⚠️ [Copy Hermes dSYM] AVISO: dSYM do Hermes não encontrado/gerado"
  echo "⚠️ Isso pode causar erro na validação do App Store"
  echo "⚠️ Verifique se o Hermes está instalado corretamente: pod install"
else
  echo "✅ [Copy Hermes dSYM] Concluído com sucesso"
  echo "✅ dSYM copiado para: ${DSYM_DEST}"
fi

