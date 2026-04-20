# Correção: Inconsistência da New Architecture

## 🔍 Problema Identificado

Havia uma **inconsistência** na configuração da New Architecture:

- ❌ **app.json**: `"newArchEnabled": true`
- ✅ **Podfile.properties.json**: `"newArchEnabled": "false"`
- ❌ **Info.plist**: `RCTNewArchEnabled: true`

## 🎯 Causa do Problema

A **New Architecture do React Native** pode causar problemas com:
- Geração de dSYMs do Hermes
- Compilação de frameworks
- Validação no App Store Connect

## ✅ Correção Aplicada

1. **app.json**: Alterado para `"newArchEnabled": false`
2. **Info.plist**: Alterado para `RCTNewArchEnabled: false`
3. **Podfile.properties.json**: Já estava como `"false"` ✅

## 📋 Próximos Passos

### 1. Reinstalar Pods
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### 2. Limpar Build
```bash
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

### 3. No Xcode
- Clean Build Folder (⇧⌘K)
- Archive (Product → Archive)
- Distribute App → App Store Connect

## 💡 Por que isso resolve?

Versões anteriores provavelmente não tinham a New Architecture ativada, então:
- O Hermes era compilado de forma tradicional
- Os dSYMs eram gerados automaticamente
- Não havia problemas de validação

Com a New Architecture desabilitada, voltamos ao comportamento anterior que funcionava.

## ⚠️ Nota

Se você precisar da New Architecture no futuro:
- Ative em **todos** os arquivos de configuração
- Use o Build Phase que já adicionamos para copiar dSYMs
- Esteja ciente de possíveis problemas de compatibilidade

