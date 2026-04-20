# Solução: Erro RevenueCat "Offerings Empty"

## 📋 Erro
```
There is an issue with your configuration. None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect (or the StoreKit Configuration file if one is being used).
```

## 🔍 Causa
No **simulador iOS**, o RevenueCat precisa usar o arquivo **StoreKit Configuration** (`.storekit`) para buscar produtos, pois não consegue acessar o App Store Connect.

## ✅ Solução

### Opção 1: Configurar no Xcode (Recomendado)

1. **Abra o Xcode:**
   ```bash
   open ios/MarcaAI.xcworkspace
   ```

2. **Selecione o target "MarcaAI"**

3. **Vá em Build Settings (⌘⌥B)**

4. **Procure por "StoreKit Configuration File"**

5. **Defina o valor:**
   - Clique duas vezes no campo
   - Digite: `MarcaAI.storekit`
   - OU arraste o arquivo `ios/MarcaAI.storekit` para o campo

6. **Verifique se o arquivo está no projeto:**
   - No Project Navigator, veja se `MarcaAI.storekit` está listado
   - Se não estiver, clique com botão direito na pasta `MarcaAI` → "Add Files to MarcaAI..."
   - Selecione `ios/MarcaAI.storekit`
   - Marque "Copy items if needed" e "Add to targets: MarcaAI"

7. **Clean Build:**
   - Product → Clean Build Folder (⇧⌘K)
   - Compile novamente (⌘R)

### Opção 2: Adicionar ao projeto manualmente

1. No Xcode, no Project Navigator
2. Clique com botão direito em "MarcaAI" folder
3. "Add Files to MarcaAI..."
4. Selecione `ios/MarcaAI.storekit`
5. Certifique-se que "Add to targets: MarcaAI" está marcado
6. Clique "Add"

### Opção 3: Verificar Produtos no RevenueCat

Certifique-se que no dashboard do RevenueCat:
- ✅ Produtos estão criados com os mesmos IDs do `.storekit`
- ✅ Offerings estão criados e têm os produtos associados
- ✅ Offerings estão publicados/ativos

**IDs dos produtos no StoreKit:**
- `Premium marca_ai_9_90_m` (precisa existir no RevenueCat também)

## 📱 Testando

Após configurar:
1. Rode o app no simulador
2. O erro deve desaparecer
3. Os produtos devem aparecer corretamente

## ⚠️ Importante

- No **simulador**: usa arquivo `.storekit`
- No **dispositivo físico**: usa App Store Connect (sandbox)
- Em **produção**: usa App Store Connect (produção)

