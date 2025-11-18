# Configuração de Deep Links no Supabase

## 1. Configurar no Dashboard do Supabase

### Authentication > URL Configuration

**Site URL:**
```
marcaai://auth/callback
```

**Redirect URLs:**
```
marcaai://auth/callback
```

## 2. Testar o Deep Link

### No Simulador iOS:

**Testar confirmação de email:**
```bash
xcrun simctl openurl booted "marcaai://auth/callback?access_token=test123&refresh_token=refresh123&type=signup"
```

**Testar reset de senha:**
```bash
xcrun simctl openurl booted "marcaai://auth/callback?access_token=test123&refresh_token=refresh123&type=recovery"
```

### No Dispositivo Real:

**Confirmação de Email:**
1. Criar conta no app
2. Verificar email
3. Clicar no link de confirmação
4. O app deve abrir automaticamente

**Reset de Senha:**
1. Solicitar recuperação de senha na tela de login
2. Verificar email
3. Clicar no link de recuperação
4. O app deve abrir automaticamente na tela de reset de senha

## 3. Verificar Logs

O componente `AuthDeepLinkHandler` irá logar:
- Deep link recebido
- Parâmetros extraídos
- Resultado da definição da sessão

## 4. Fluxo Completo

### Confirmação de Email:
1. **Usuário cria conta** → `signUp()` com `emailRedirectTo: 'marcaai://auth/callback'`
2. **Recebe email** → Link contém `marcaai://auth/callback?access_token=...&refresh_token=...&type=signup`
3. **Clica no link** → App abre via deep link
4. **AuthDeepLinkHandler** → Captura URL e define sessão no Supabase
5. **Navega** → Para `/email-confirmation`
6. **Usuário clica "Email Verificado"** → Vai para `/cadastro-usuario`

### Reset de Senha:
1. **Usuário solicita recuperação** → `sendPasswordResetEmail()` com `redirectTo: 'marcaai://auth/callback'`
2. **Recebe email** → Link contém `marcaai://auth/callback?access_token=...&refresh_token=...&type=recovery`
3. **Clica no link** → App abre via deep link
4. **AuthDeepLinkHandler** → Detecta `type=recovery`, define sessão no Supabase
5. **Navega** → Para `/reset-password`
6. **Usuário define nova senha** → Senha é atualizada e redireciona para `/login`

## 5. Troubleshooting

### Se o link não abrir o app:
- Verificar se o `scheme` no `app.json` está correto
- Verificar se o app está instalado no dispositivo
- Verificar se as configurações do Supabase estão corretas

### Se o app abrir mas mostrar "Link de recuperação inválido":
1. **Verificar logs no console** - O `AuthDeepLinkHandler` agora tem logs detalhados:
   - `🔵 [Deep Link] URL recebida:` - Mostra a URL completa recebida
   - `🔍 [parseCustomURL]` - Mostra o processo de parsing
   - `🔵 [Reset Password]` - Mostra os parâmetros extraídos
   - `❌ [Reset Password]` - Mostra erros específicos

2. **Verificar formato da URL** - O Supabase envia:
   - Link de confirmação: `marcaai://auth/callback?access_token=...&refresh_token=...&type=signup`
   - Link de reset: `marcaai://auth/callback?access_token=...&refresh_token=...&type=recovery`
   
   O código diferencia pelo parâmetro `type`.

3. **Verificar configuração no Supabase:**
   - Authentication > URL Configuration
   - Redirect URLs deve incluir: `marcaai://auth/callback`
   - Site URL deve estar configurado

4. **Copiar URL do email:**
   - Clique com botão direito no link do email
   - Copie o endereço do link
   - Verifique o formato da URL
   - Compare com os logs no console

5. **Ver documentação completa:** Veja `TROUBLESHOOTING_RESET_PASSWORD.md` para mais detalhes
