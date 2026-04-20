# 📱 Guia de Comandos - Marca AI

## 🚀 Configuração Inicial do EAS CLI

### 1. Instalar EAS CLI
```bash
npm install -g eas-cli
```

### 2. Fazer Login no Expo
```bash
eas login
```

**Credenciais:**
- Email: organizei
- Senha: `!Campob...`

### 3. Configurar EAS no Projeto
```bash
eas build:configure
```

---

## 📦 Build de Aplicativos

### Android (APK/AAB)

#### Build de Desenvolvimento
```bash
eas build --platform android --profile development
```

#### Build de Preview (APK)
```bash
eas build --platform android --profile preview
```

#### Build de Produção (AAB)
```bash
eas build --platform android --profile production
```

---

### iOS (IPA)

#### Build de Desenvolvimento
```bash
eas build --platform ios --profile development
```

#### Build de Preview
```bash
eas build --platform ios --profile preview
```

#### Build de Produção
```bash
eas build --platform ios --profile production
```

---

## 🔄 Comandos Úteis

### Ver Status dos Builds
```bash
eas build:list
```

### Ver Builds de uma Plataforma Específica
```bash
eas build:list --platform android
eas build:list --platform ios
```

### Cancelar um Build
```bash
eas build:cancel
```

### Ver Informações do Projeto
```bash
eas project:info
```

---

## 📲 Submissão para Lojas

### Submeter para Google Play Store
```bash
eas submit --platform android
```

### Submeter para Apple App Store
```bash
eas submit --platform ios
```

---

## 🔧 Desenvolvimento Local

### Iniciar o App
```bash
npm start
# ou
npx expo start
```

### Limpar Cache
```bash
npx expo start --clear
```

### Rodar no Android
```bash
npm run android
```

### Rodar no iOS
```bash
npm run ios
```

---

## 🛠️ Utilitários

### Atualizar Dependências
```bash
npm update
```

### Verificar Problemas
```bash
npx expo-doctor
```

### Ver Versão do EAS
```bash
eas --version
```

### Fazer Logout
```bash
eas logout
```

---

## 📝 Notas Importantes

- **Perfis de Build:** Configurados em `eas.json`
- **Android:** Gera `.apk` (preview) ou `.aab` (production)
- **iOS:** Requer certificados e provisionamento (Apple Developer)
- **Builds:** Executados na nuvem do Expo
- **Tempo médio:** 10-20 minutos por build

---

## 🔗 Links Úteis

- [Documentação EAS](https://docs.expo.dev/eas/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)
- [Expo Dashboard](https://expo.dev/)

---

## 🚨 Troubleshooting

### Erro de Assinatura Incompatível no Android
**Erro:** `INSTALL_FAILED_UPDATE_INCOMPATIBLE: Package signatures do not match`

**Solução:** Desinstalar o app existente do dispositivo antes de instalar a versão de debug:

```bash
# Desinstalar o app do dispositivo conectado
adb uninstall com.marcaai.app

# Ou desinstalar de um dispositivo específico
adb -s RQ8N8071P1Y uninstall com.marcaai.app

# Depois, rodar novamente
npm run android
```

**Alternativa:** Desinstalar manualmente pelo dispositivo Android (Configurações > Apps > Marca AI > Desinstalar)

### Build Falhou
```bash
# Ver detalhes do erro
eas build:list
# Clicar no link do build para ver logs completos
```

### Limpar Credenciais
```bash
eas credentials
```

### Problemas de Dependências
```bash
rm -rf node_modules
npm install
```

---

**Última atualização:** Novembro 2025