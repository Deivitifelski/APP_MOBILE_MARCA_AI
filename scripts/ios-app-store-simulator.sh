#!/usr/bin/env bash
# Simulador com resolução aceita pelo slot "iPhone 6,5 pol." na App Store Connect:
# 1284×2778 (retrato) ou 2778×1284 (paisagem).
# iPhone 16/17 Pro Max usam outra resolução nativa e geram rejeição no upload.

set -euo pipefail

DEVICE_NAME='iPhone 13 Pro Max (App Store)'
DEVICE_TYPE='com.apple.CoreSimulator.SimDeviceType.iPhone-13-Pro-Max'

if [[ -n "${IOS_SIM_RUNTIME:-}" ]]; then
  RUNTIME="$IOS_SIM_RUNTIME"
else
  RUNTIME=$(xcrun simctl list runtimes available | grep -E '^\s*iOS' | tail -1 | sed -E 's/.* - (com\.apple\.CoreSimulator\.SimRuntime\.iOS-[^)]+).*/\1/')
fi

if [[ -z "$RUNTIME" ]]; then
  echo "Nenhum runtime iOS disponível. Instale um simulador em Xcode → Settings → Platforms."
  exit 1
fi

UDID=$(xcrun simctl list devices available | grep "$DEVICE_NAME" | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/' | head -1)

if [[ -z "${UDID:-}" ]]; then
  echo "Criando simulador: $DEVICE_NAME"
  UDID=$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_TYPE" "$RUNTIME")
  echo "Criado com UDID: $UDID"
else
  echo "Usando simulador existente: $DEVICE_NAME ($UDID)"
fi

xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$UDID"

echo ""
echo "Pronto. Este simulador gera PNG em 1284×2778 (retrato), aceito pela App Store."
echo ""
echo "Captura:"
echo "  • Simulator → File → Save Screen Shot  (Cmd+S), ou"
echo "  • Terminal: xcrun simctl io booted screenshot ~/Desktop/marca-ai-01.png"
echo ""
echo "Rodar o app neste simulador:"
echo "  npx expo run:ios --device \"$DEVICE_NAME\""
echo ""
