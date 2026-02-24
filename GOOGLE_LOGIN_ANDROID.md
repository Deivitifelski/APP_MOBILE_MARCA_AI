# Login com Google no Android

O app usa o pacote **`com.marcaaipro.app`**. Para o login funcionar é obrigatório um **cliente OAuth 2.0 do tipo Android** no Google Cloud com o **mesmo pacote** e o **SHA-1** do keystore. Se der DEVELOPER_ERROR ou INTERNAL_ERROR, quase sempre é **SHA-1 errado ou faltando**.

---

## Checklist rápido (copiar e colar no Google Cloud)

| Campo no Google Cloud | Valor (copie exatamente) |
|----------------------|---------------------------|
| **Application type** | Android |
| **Package name**     | `com.marcaaipro.app` |
| **SHA-1**            | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |

- [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID** → tipo **Android**.
- Cole o SHA-1 **com os dois-pontos** (formato `XX:XX:XX:...`).
- Depois de salvar, espere **5–10 minutos** e tente o login de novo.

---

## 1. SHA-1 do keystore (debug)

Para **debug** (desenvolvimento), o SHA-1 do keystore padrão do projeto é:

```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

**SHA-256** do mesmo keystore (opcional; no Firebase você pode adicionar os dois):

```
FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
```

Para obter o SHA-1 manualmente (ou de outro keystore):

```bash
# Debug (keystore do projeto)
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Ou o keystore de release, se já tiver
keytool -list -v -keystore /caminho/para/seu/keystore.jks -alias seu_alias
```

Copie a linha **SHA1** da saída.

## 2. Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/) e selecione o projeto do app.
2. Vá em **APIs & Services** → **Credentials**.
3. Clique em **+ CREATE CREDENTIALS** → **OAuth client ID**.
4. Se pedir, configure a **tela de consentimento OAuth** (nome do app, email de suporte, etc.).
5. Em **Application type** escolha **Android**.
6. Preencha:
   - **Name:** por exemplo `Marca AI Android` ou `Marca AI (debug)`.
   - **Package name:** `com.marcaaipro.app` (exatamente este).
   - **SHA-1 certificate fingerprint:** cole o SHA-1 (ex.: o da seção 1 para debug).
7. Clique em **Create**.

Guarde o **Client ID** gerado; o app já usa o **Web Client ID** no código para o token que o Supabase valida, então não é necessário alterar nada no código por causa desse cliente Android.

## 3. Web Client ID (já usado no app)

O login com Google no app usa **signInWithIdToken** do Supabase. Por isso o código já está configurado com o **Web Client ID** (tipo “Web application” no Google Cloud):

- `169304206053-i5bm2l2sofd011muqr66ddm2dosn5bn9.apps.googleusercontent.com`

Esse mesmo projeto deve ter:
- Um cliente OAuth **Web** (esse ID acima) — usado pelo backend/Supabase.
- Um cliente OAuth **Android** (criado no passo 2) — pacote `com.marcaaipro.app` + SHA-1.

Não use o Client ID do cliente Android no lugar do Web Client ID no código.

## 4. Firebase (opcional para FCM)

Se o app usa Firebase (ex.: FCM para notificações):

1. No [Firebase Console](https://console.firebase.google.com/), adicione um app Android com package name **`com.marcaaipro.app`**.
2. Registre o **SHA-1** do debug (e depois o de release, se for publicar).
3. Baixe o **`google-services.json`** e coloque em `android/app/` (ou na raiz do projeto e referencie em `app.json` em `expo.android.googleServicesFile`).
4. Rode `npx expo prebuild --clean` se usar Expo prebuild, e depois gere o build de novo.

## 5. Supabase

No **Supabase Dashboard** → **Authentication** → **Providers** → **Google**:

- Use o **Client ID** e **Client Secret** do cliente OAuth **Web** (não do Android).
- Authorized redirect URI no Google Cloud deve incluir:  
  `https://<seu-projeto>.supabase.co/auth/v1/callback`

## 6. Rebuild do app

Depois de criar o cliente Android e, se usar, de colocar o `google-services.json`:

```bash
cd android && ./gradlew clean
cd .. && npx expo run:android
```

Ou, se usar EAS:

```bash
eas build --platform android --profile development
```

## Resumo rápido

| Onde              | O quê |
|-------------------|--------|
| Package do app    | `com.marcaaipro.app` |
| SHA-1 (debug)     | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| Google Cloud      | Criar cliente OAuth **Android** com esse package + SHA-1 |
| Código do app     | Já usa o **Web Client ID**; não trocar pelo Client ID do Android |
| Supabase          | Configurar Google com Client ID/Secret do cliente **Web** |

Se ainda aparecer **DEVELOPER_ERROR**, **INTERNAL_ERROR** ou código **10**:

1. **SHA-1** no Google Cloud deve ser **exatamente** (com dois-pontos):  
   `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`  
   - Sem espaço, sem trocar letras (maiúsculas como acima).
   - Se você assina com **outro** keystore (ex.: EAS ou release), pegue o SHA-1 desse keystore e adicione **também** no mesmo cliente Android (ou crie outro cliente com esse SHA-1).
2. **Package name** exatamente: `com.marcaaipro.app`.
3. **Firebase:** se usar FCM, no app Android do Firebase adicione o **mesmo** SHA-1 em "SHA certificate fingerprints".
4. Espere **5–10 minutos** após salvar no Console e tente de novo.
