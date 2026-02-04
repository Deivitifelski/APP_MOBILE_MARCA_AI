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
