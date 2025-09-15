# 🔗 **Configuração Completa de Magic Links - Supabase + React Native**

## 📋 **Configurações do Supabase Dashboard**

### **1. Acesse:**
```
https://supabase.com/dashboard/project/ctulmpyaikxsnjqmrzxf/auth/url-configuration
```

### **2. Site URL:**
```
marcaai://auth/callback
```

### **3. Redirect URLs (adicione todas):**
```
marcaai://auth/callback
marcaai://auth/callback/*
marcaai://auth/*
marcaai://*
https://marcaai.com/auth/callback
https://marcaai.com/auth/callback/*
http://localhost:8081
http://localhost:3000
```

---

## 🏗️ **Arquivos de Configuração**

### **app.json (Expo)**
```json
{
  "expo": {
    "scheme": "marcaai",
    "ios": {
      "bundleIdentifier": "com.marcaai.mobile",
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLName": "com.marcaai.mobile.auth",
            "CFBundleURLSchemes": ["marcaai"]
          }
        ],
        "com.apple.developer.associated-domains": ["applinks:marcaai.com"]
      },
      "associatedDomains": ["applinks:marcaai.com"]
    },
    "android": {
      "package": "com.marcaai.mobile",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "marcaai",
              "host": "auth"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        },
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "marcaai.com",
              "pathPrefix": "/auth"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### **AndroidManifest.xml (Para projetos nativos)**
```xml
<activity android:name=".MainActivity">
  <!-- Deep Links -->
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="marcaai" android:host="auth" />
  </intent-filter>
  
  <!-- Universal Links -->
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="marcaai.com" android:pathPrefix="/auth" />
  </intent-filter>
</activity>
```

### **Info.plist (Para projetos nativos iOS)**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.marcaai.mobile.auth</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>marcaai</string>
    </array>
  </dict>
</array>

<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:marcaai.com</string>
</array>
```

---

## 🎯 **Fluxo Completo de Magic Links**

### **1. Envio do Magic Link**
```typescript
// services/auth/magicLinkService.ts
const { data, error } = await supabase.auth.signInWithOtp({
  email: email,
  options: {
    emailRedirectTo: 'marcaai://auth/callback',
    shouldCreateUser: true
  }
});
```

### **2. Processamento do Deep Link**
```typescript
// Capturar URL
const url = await Linking.getInitialURL();

// Extrair parâmetros
const urlObj = new URL(url);
const accessToken = urlObj.searchParams.get('access_token');
const refreshToken = urlObj.searchParams.get('refresh_token');
const code = urlObj.searchParams.get('code');

// Método 1: Tokens diretos
if (accessToken && refreshToken) {
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
}

// Método 2: Código para trocar
if (code) {
  await supabase.auth.exchangeCodeForSession(code);
}
```

### **3. Listener de Deep Links**
```typescript
// app/_layout.tsx
useEffect(() => {
  const cleanup = magicLinkService.initializeListener();
  return cleanup;
}, []);
```

---

## 🛡️ **Boas Práticas de Segurança**

### **1. Validação de URLs**
```typescript
const isValidAuthURL = (url: string): boolean => {
  return url.startsWith('marcaai://auth/') || 
         url.startsWith('https://marcaai.com/auth/');
};
```

### **2. Timeout de Tokens**
```typescript
const TOKEN_TIMEOUT = 10 * 60 * 1000; // 10 minutos

const isTokenExpired = (timestamp: string): boolean => {
  return Date.now() - new Date(timestamp).getTime() > TOKEN_TIMEOUT;
};
```

### **3. Verificação de Domínio**
```typescript
const ALLOWED_HOSTS = ['marcaai.com', 'supabase.co'];

const isAllowedHost = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ALLOWED_HOSTS.some(host => urlObj.hostname.endsWith(host));
  } catch {
    return false;
  }
};
```

---

## 🧪 **Como Testar**

### **1. Desenvolvimento (Simulador)**
```bash
# iOS
xcrun simctl openurl booted "marcaai://auth/callback?access_token=test&refresh_token=test"

# Android
adb shell am start -W -a android.intent.action.VIEW -d "marcaai://auth/callback?access_token=test&refresh_token=test" com.marcaai.mobile
```

### **2. Produção**
1. Configure domínio real no Supabase
2. Publique arquivo `.well-known/apple-app-site-association` para iOS
3. Configure Digital Asset Links para Android
4. Teste em dispositivos reais

---

## 🚀 **Deployment**

### **1. Universal Links (iOS)**
Arquivo: `https://marcaai.com/.well-known/apple-app-site-association`
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.marcaai.mobile",
        "paths": ["/auth/*"]
      }
    ]
  }
}
```

### **2. App Links (Android)**
Arquivo: `https://marcaai.com/.well-known/assetlinks.json`
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.marcaai.mobile",
      "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
    }
  }
]
```

---

## 📱 **Exemplo de Uso Completo**

### **1. Enviar Magic Link**
```typescript
import { magicLinkService } from '../services/auth/magicLinkService';

const handleSendMagicLink = async (email: string) => {
  const result = await magicLinkService.sendMagicLink(email);
  
  if (result.success) {
    Alert.alert('Sucesso', 'Link enviado! Verifique seu email.');
  } else {
    Alert.alert('Erro', result.error);
  }
};
```

### **2. Capturar Deep Link**
```typescript
// Automático via _layout.tsx
useEffect(() => {
  const cleanup = magicLinkService.initializeListener();
  return cleanup;
}, []);
```

### **3. Logs para Debug**
```typescript
// Verificar se deep links estão funcionando
console.log('URL recebida:', url);
console.log('Tokens extraídos:', { accessToken, refreshToken, code });
console.log('Usuário autenticado:', user);
```

---

## ⚠️ **Troubleshooting**

### **1. Deep Link não funciona**
- Verificar se scheme está registrado
- Rebuild do app após mudanças
- Verificar logs do console

### **2. Universal Links não funcionam**
- Verificar arquivo `.well-known`
- Verificar certificado SSL
- Verificar Team ID (iOS)

### **3. Tokens inválidos**
- Verificar se URLs estão configuradas no Supabase
- Verificar se tokens não expiraram
- Verificar se usuário existe

---

## 🔍 **Monitoramento**

### **1. Analytics**
```typescript
// Rastrear sucesso/falha de magic links
analytics.track('magic_link_sent', { email });
analytics.track('magic_link_opened', { success: true });
analytics.track('magic_link_failed', { error: errorMessage });
```

### **2. Error Tracking**
```typescript
// Capturar erros de deep links
try {
  await handleMagicLink(url);
} catch (error) {
  errorTracking.captureException(error, { url });
}
```
