# Troubleshooting - Reset de Senha

## Problema: "Link de recuperação inválido"

### Possíveis Causas e Soluções

#### 1. Verificar Configuração no Supabase Dashboard

**Authentication > URL Configuration:**

- **Site URL:** Deve ser configurado (pode ser `marcaai://auth/callback` ou uma URL HTTP)
- **Redirect URLs:** Deve incluir:
  ```
  marcaai://reset-password
  marcaai://auth/callback
  ```

#### 2. Verificar o Formato da URL no Email

O Supabase pode enviar o link em diferentes formatos:

**Formato 1 - Com tokens diretos:**
```
marcaai://reset-password?access_token=...&refresh_token=...&type=recovery
```

**Formato 2 - Com código:**
```
marcaai://reset-password?code=...&type=recovery
```

**Formato 3 - Com hash (#):**
```
marcaai://reset-password#access_token=...&refresh_token=...&type=recovery
```

O código agora suporta todos esses formatos.

#### 3. Verificar Logs no Console

Quando o link é clicado, verifique os logs no console:

```
🔵 [Deep Link] URL recebida: ...
🔍 [parseCustomURL] URL original: ...
🔵 [Reset Password] Processando deep link de reset de senha
🔵 [Reset Password] Path: ...
🔵 [Reset Password] Todos os parâmetros: ...
```

Se os tokens não estiverem sendo encontrados, os logs mostrarão:
```
❌ [Reset Password] Nem código nem tokens encontrados na URL
❌ [Reset Password] URL completa: ...
❌ [Reset Password] Parâmetros disponíveis: ...
```

#### 4. Verificar se o Supabase está Redirecionando Corretamente

O Supabase pode estar redirecionando para uma URL intermediária. Verifique:

1. Abra o email de recuperação
2. Clique com botão direito no link e "Copiar endereço do link"
3. Verifique o formato da URL

Se a URL começar com `https://`, o Supabase pode estar usando uma página intermediária. Nesse caso:

**Solução:** Configure uma URL HTTP intermediária que redirecione para o deep link:

1. Crie uma página web simples que redirecione:
```html
<!DOCTYPE html>
<html>
<head>
  <script>
    // Extrair parâmetros da URL atual
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Combinar parâmetros (query string tem prioridade)
    const params = new URLSearchParams();
    for (const [key, value] of hashParams) {
      params.append(key, value);
    }
    for (const [key, value] of urlParams) {
      params.set(key, value);
    }
    
    // Construir deep link
    const deepLink = `marcaai://reset-password?${params.toString()}`;
    
    // Redirecionar
    window.location.href = deepLink;
  </script>
</head>
<body>
  <p>Redirecionando...</p>
</body>
</html>
```

2. Configure no Supabase:
   - **Redirect URLs:** Adicione a URL HTTP da página intermediária
   - **redirectTo no código:** Use a URL HTTP intermediária

#### 5. Verificar se o App Está Instalado

O deep link só funciona se o app estiver instalado no dispositivo.

#### 6. Testar Manualmente

No simulador iOS:
```bash
xcrun simctl openurl booted "marcaai://reset-password?access_token=test123&refresh_token=refresh123&type=recovery"
```

No dispositivo Android:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "marcaai://reset-password?access_token=test123&refresh_token=refresh123&type=recovery"
```

#### 7. Verificar Configuração do App

**app.json:**
- `scheme: "marcaai"` deve estar configurado

**iOS (Info.plist):**
- `CFBundleURLSchemes` deve incluir `marcaai`

**Android (AndroidManifest.xml):**
- Intent filter com `scheme="marcaai"` deve estar configurado

## Próximos Passos

1. Verifique os logs no console quando clicar no link
2. Copie a URL completa do link no email
3. Verifique se os parâmetros estão sendo extraídos corretamente
4. Se necessário, configure uma URL HTTP intermediária

