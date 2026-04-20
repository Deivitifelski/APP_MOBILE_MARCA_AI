# 🔥 Configurar Firebase no Android para Mensagens Push

## ✅ Configuração do Gradle (Já Feita)

O plugin do Google Services já foi adicionado aos arquivos:
- ✅ `android/build.gradle` - Plugin adicionado
- ✅ `android/app/build.gradle` - Plugin aplicado condicionalmente
- ✅ `android/app/src/main/AndroidManifest.xml` - Permissões adicionadas

## 📋 Passo a Passo: Obter google-services.json

### 1. Acessar Firebase Console

1. Acesse: https://console.firebase.google.com/
2. Faça login com sua conta Google
3. Selecione o projeto: **marcaai-app-7318d**

### 2. Adicionar App Android

1. No painel do projeto, clique no ícone de **engrenagem** (⚙️) → **Configurações do projeto**
2. Role até a seção **Seus apps**
3. Se já existir um app Android, pule para o passo 3
4. Se não existir, clique em **Adicionar app** → escolha o ícone do **Android** (🤖)

### 3. Configurar App Android

Preencha os seguintes dados:

- **Nome do pacote Android**: `com.marcaai.app`
- **Apelido do app** (opcional): `Marca AI Android`
- **Certificado de depuração SHA-1** (opcional para desenvolvimento): Pode pular por enquanto

### 4. Baixar google-services.json

1. Após adicionar o app, clique em **Baixar google-services.json**
2. Salve o arquivo no seu computador

### 5. Adicionar ao Projeto

1. Copie o arquivo `google-services.json` para a pasta:
   ```
   android/app/google-services.json
   ```

2. **IMPORTANTE**: O arquivo deve estar exatamente em `android/app/google-services.json`

### 6. Verificar Estrutura

A estrutura de pastas deve ficar assim:

```
android/
├── app/
│   ├── google-services.json  ← Arquivo aqui!
│   ├── build.gradle
│   └── src/
└── build.gradle
```

## 🚀 Testar a Configuração

### Build Local (Opcional)

```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Build com EAS

```bash
eas build --platform android --profile preview
```

## ✅ Verificação

Após adicionar o arquivo, o build deve mostrar:

```
✅ google-services.json encontrado. Firebase será configurado.
```

## 🔔 Habilitar Cloud Messaging no Firebase

1. No Firebase Console, vá em **Cloud Messaging**
2. Certifique-se de que o Cloud Messaging está habilitado
3. Se necessário, configure as credenciais do servidor (para envio de notificações)

## 📱 Informações do Projeto

- **Project ID**: `marcaai-app-7318d`
- **Package Android**: `com.marcaai.app`
- **GCM Sender ID**: `421928940814` (mesmo do iOS)

## 🐛 Troubleshooting

### Erro: "File google-services.json is missing"
- Verifique se o arquivo está em `android/app/google-services.json`
- Certifique-se de que o nome do arquivo está correto (sem espaços)

### Erro: "Package name mismatch"
- Verifique se o `package` no `app.json` corresponde ao configurado no Firebase
- Deve ser: `com.marcaai.app`

### Build funciona mas notificações não chegam
- Verifique se o Cloud Messaging está habilitado no Firebase Console
- Verifique as permissões no `AndroidManifest.xml`
- Certifique-se de que o token FCM está sendo gerado corretamente

## 📝 Notas

- O arquivo `GoogleService-Info.plist` já está configurado para iOS
- O `google-services.json` é necessário apenas para Android
- O plugin do Google Services só será aplicado se o arquivo existir (configuração condicional)

## 🔗 Links Úteis

- [Firebase Console](https://console.firebase.google.com/)
- [Documentação Firebase Android](https://firebase.google.com/docs/android/setup)
- [React Native Firebase - Messaging](https://rnfirebase.io/messaging/usage)

