# Como abrir o projeto no Xcode

**Sempre abra o workspace, nunca o .xcodeproj:**

```bash
open MarcaAI.xcworkspace
```

Ou, na raiz do projeto:

```bash
open ios/MarcaAI.xcworkspace
```

Se você abrir **MarcaAI.xcodeproj** em vez do **MarcaAI.xcworkspace**, o Xcode não carrega os Pods (Expo, React Native, etc.) e aparece o erro:

- **"No such module 'Expo'"**

O **.xcworkspace** inclui o app e o projeto Pods; assim o Xcode compila primeiro os Pods (Expo e demais dependências) e depois o app.

---

## Se der "Command Libtool failed with a nonzero exit code"

1. **Feche o Xcode** por completo (Cmd+Q).
2. No Terminal, na pasta do projeto:
   ```bash
   cd ios
   ./limpar-tudo.sh
   pod install
   ```
3. Abra de novo o **MarcaAI.xcworkspace** (não o .xcodeproj).
4. No Xcode: **Product → Clean Build Folder** (⇧⌘K).
5. Selecione o destino (iPhone físico ou simulador) e **Product → Run** (⌘R).

Se ainda falhar, apague o DerivedData manualmente com o Xcode fechado:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/MarcaAI-*
```
Depois abra o workspace e faça Clean Build + Run de novo.
