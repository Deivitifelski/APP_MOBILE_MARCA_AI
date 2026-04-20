# Solução para Erro de dSYM do Hermes

## Problema
```
The archive did not include a dSYM for the hermes.framework with the UUIDs [BA3C949A-7707-3472-B346-D3E0690C88D0]
```

## Solução Aplicada

### 1. Configuração no projeto Xcode
Ajustei o arquivo `project.pbxproj` para:
- **Desabilitar validação de produto** (`VALIDATE_PRODUCT = NO`) na configuração Release
- **Definir formato de debug** (`DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"`)

### 2. Limpeza e Reinstalação

Execute o script de limpeza:
```bash
./fix-hermes-dsym-completo.sh
```

Ou manualmente:
```bash
# Limpar DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Limpar build
rm -rf ios/build

# Reinstalar Pods
cd ios
pod install
cd ..
```

### 3. Configurações Adicionais no Xcode (se necessário)

Se o erro persistir, configure manualmente no Xcode:

1. Abra o projeto:
   ```bash
   open ios/MarcaAI.xcworkspace
   ```

2. Selecione o target **MarcaAI**

3. Vá em **Build Settings** e configure:

   **a) Debug Information Format:**
   - Debug: `DWARF`
   - Release: `DWARF with dSYM File`

   **b) Strip Debug Symbols During Copy:**
   - Debug: `NO`
   - Release: `YES`

   **c) Validate Built Product:**
   - Defina como `NO` (já configurado no projeto)

4. Faça **Clean Build Folder** (⇧⌘K)

5. Compile novamente (⌘R)

## Nota Importante

⚠️ **Para builds de produção/App Store:**
- Se você precisar fazer upload para a App Store, pode ser necessário manter `VALIDATE_PRODUCT = YES`
- Nesse caso, o erro pode ser apenas um warning que não impede o funcionamento
- Você pode ignorar o warning se o app funcionar corretamente

## Alternativa: Ignorar o Warning

Se o erro não afetar o funcionamento do app, você pode:
1. Ignorar o warning durante o desenvolvimento
2. Manter `VALIDATE_PRODUCT = YES` apenas para builds de produção
3. O dSYM do Hermes não é crítico para o funcionamento do app

## Verificação

Após aplicar as mudanças:
1. Faça Clean Build (⇧⌘K)
2. Compile o projeto (⌘R)
3. Verifique se o erro desapareceu ou se é apenas um warning

