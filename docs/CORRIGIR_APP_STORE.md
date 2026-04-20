# Correção para Upload na App Store

## Problemas Corrigidos

### 1. ✅ Build Number Incrementado
- **Antes**: Build 8 (já usado)
- **Agora**: Build 9
- Alterado em:
  - `app.json`: `buildNumber: "9"`
  - `project.pbxproj`: `CURRENT_PROJECT_VERSION = 9` (Debug e Release)

### 2. ✅ dSYM do Hermes Configurado
- `VALIDATE_PRODUCT = YES` (necessário para App Store)
- `DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"` (Release)
- `STRIP_STYLE = "non-global"` (Release)
- Podfile atualizado para gerar dSYM do Hermes

## Passos para Fazer Upload

### 1. Reinstalar Pods
```bash
cd ios
pod install
cd ..
```

### 2. Configurar Build Phase no Xcode (IMPORTANTE)

1. Abra o projeto:
   ```bash
   open ios/MarcaAI.xcworkspace
   ```

2. Selecione o target **MarcaAI**

3. Vá em **Build Phases**

4. Clique em **+** e selecione **New Run Script Phase**

5. Nomeie como: **Copy Hermes dSYM**

6. Cole o seguinte script:
   ```bash
   # Copiar dSYM do Hermes para o archive
   if [ -d "${PODS_ROOT}/hermes-engine/destroot" ]; then
     find "${PODS_ROOT}/hermes-engine/destroot" -name "*.dSYM" -exec cp -R {} "${DWARF_DSYM_FOLDER_PATH}" \;
   fi
   
   # Também procurar em outros locais possíveis
   if [ -d "${PODS_ROOT}/hermes-engine" ]; then
     find "${PODS_ROOT}/hermes-engine" -name "*.dSYM" -exec cp -R {} "${DWARF_DSYM_FOLDER_PATH}" \;
   fi
   ```

7. **Arraste este script para ANTES de "Embed Frameworks"** (ou no final, mas antes do último script)

8. Marque **"Run script only when installing"** (opcional, mas recomendado)

### 3. Verificar Build Settings

No Xcode, vá em **Build Settings** e verifique:

- **Debug Information Format** (Release): `DWARF with dSYM File`
- **Validate Built Product**: `YES`
- **Strip Debug Symbols During Copy** (Release): `YES`

### 4. Clean e Archive

1. **Clean Build Folder**: ⇧⌘K
2. **Archive**: Product → Archive
3. Aguarde o build completar
4. No Organizer, clique em **Distribute App**
5. Selecione **App Store Connect**
6. Siga o assistente

## Alternativa: Usar EAS Build

Se continuar tendo problemas, use o EAS Build que gerencia isso automaticamente:

```bash
# Instalar EAS CLI (se não tiver)
npm install -g eas-cli

# Configurar
eas build:configure

# Build para iOS
eas build --platform ios --profile production
```

## Verificação

Após o upload, verifique no App Store Connect:
- O build deve aparecer sem erros de validação
- O dSYM deve ser processado corretamente
- Não deve haver warnings sobre símbolos faltando

## Se o Erro Persistir

Se ainda der erro de dSYM, você pode:

1. **Desabilitar validação temporariamente** (não recomendado para produção):
   - `VALIDATE_PRODUCT = NO` (apenas para testar)

2. **Usar EAS Build** que gerencia isso automaticamente

3. **Verificar se o Hermes está sendo compilado corretamente**:
   ```bash
   cd ios
   pod install --repo-update
   ```

## Notas

- O build number deve ser incrementado a cada upload
- O dSYM do Hermes é necessário para crash reports no App Store
- Se você usar EAS Build, não precisa se preocupar com essas configurações

