# Testar IAP em Sandbox real (Apple)

## ⚠️ Leia isto primeiro (erro mais comum)

**Não deixe a conta sandbox como “conta da App Store” fixa no iPhone** (Ajustes → Compras / mídia). Isso faz o sistema **pedir a senha de novo e de novo**, `fetchProducts` voltar **vazio** ou a loja se comportar mal.

**Faça assim:** saia dessa conta em **Ajustes → [seu nome] → Compras na iTunes Store e App Store → Sair**. No aparelho use sua **Apple ID pessoal** no iCloud (ou fique sem login de **compras**). A sandbox você digita **só** na **janela que abre ao tocar em Assinar** dentro do app.

**“Nenhuma assinatura” nos logs** (`getActiveSubscriptions` / `getAvailablePurchases` vazios) é **normal** se você **ainda não finalizou uma compra** até o fim. **Só entrar com a senha não cria assinatura** — é preciso concluir o fluxo de compra de teste (confirmar na folha da Apple).

### Fluxo no app (iOS)

Na tela **Assine Premium**, o app **não** chama a loja até você tocar em **“Estou pronto — carregar planos da App Store”**. Assim você lê o aviso, sai da sandbox nos Ajustes se precisar, e **só então** o iOS pede login — use **nesse momento** o **testador Sandbox** (e-mail/senha do Connect), não “só” a senha da Apple ID do aparelho por hábito. A confirmação fica salva no aparelho; use **“Limpar confirmação e ver de novo”** se quiser rever o passo a passo.

Objetivo: `environmentIOS` = **`Sandbox`** nos logs (não **`Xcode`**), compras visíveis no App Store Connect e webhooks da Apple funcionando.

## 1. Xcode

1. Abra **`MarcaAI.xcworkspace`** (não só o `.xcodeproj`, se usar CocoaPods).
2. **Product → Scheme → Edit Scheme… → Run → Options**
3. **StoreKit Configuration** = **None** (vazio).  
   - Se houver um `.storekit` selecionado, a loja fica **local** → `environmentIOS: "Xcode"` → **sem** webhook / sem “Última compra” no Connect.
4. **Product → Clean Build Folder** (⇧⌘K) e rode de novo.

## 2. Projeto (repo)

- O scheme compartilhado **`MarcaAI`** não deve incluir `StoreKitConfigurationFileReference`.
- Nenhum arquivo `.storekit` deve estar em **Copy Bundle Resources** do target (evita comportamento estranho no bundle).

## 3. Dispositivo

- Use **iPhone físico** conectado ao Mac (recomendado).
- O app deve ser o **`com.marcaai.app`** com assinaturas **`marcaai_mensal_app`** / **`marcaai_anual_app`** no App Store Connect.

## 4. Conta Sandbox

- **Não** faça login com a conta sandbox em **Ajustes → App Store** como Apple ID de **Compras na iTunes Store e App Store** (a Apple desaconselha e isso costuma gerar **erro de senha**, conta bloqueada ou comportamento estranho).
- O recomendado no iPhone:
  - Use sua **Apple ID pessoal** no aparelho (iCloud) **ou** deixe **Compras** desligadas / sem conta sandbox fixa.
  - Abra o app → **Assinar** → quando aparecer a folha da App Store, **aí sim** entre com **e-mail + senha do testador Sandbox** (App Store Connect → **Usuários e acesso** → **Sandbox** → **Testadores**).

### 4.1 “Senha incorreta” mesmo estando “logado” com sandbox no aparelho

Se você colocou a sandbox em **Ajustes → [seu nome] → Compras na iTunes Store e App Store** (ou App Store antigo):

1. **Saia** dessa conta de compras: **Ajustes → Compras na iTunes Store e App Store → Sair** (ou equivalente no seu iOS).
2. Reinicie o app e inicie a compra de novo; use a sandbox **só na janela que o sistema abre** na hora da compra.
3. No **App Store Connect**, confira se o testador existe e **redefina a senha** do sandbox (editar testador → nova senha). A senha é **só** da conta sandbox, não da sua Apple ID real.
4. Se continuar falhando, crie **outro e-mail** de testador sandbox no Connect e use esse na compra (contas antigas às vezes “travam”).
5. Confirme que o testador está com **mesmo país** que a loja (ex.: Brasil) e que não há **Ask to Buy** bloqueando (família).

### 4.2 Sempre pede senha na tela de assinatura e “não tem assinatura”

1. **Saia** da sandbox em **Ajustes → Compras na iTunes Store e App Store** (passo 4.1).  
2. Abra **Assine Premium** de novo; se pedir login, use **só** o e-mail/senha do testador **nessa folha**.  
3. Se os **planos** (preços) não aparecerem: toque em **Atualizar loja agora** ou puxe para atualizar; confira SKUs no Connect (`SOLUCAO_IAP_IOS_PRODUTOS_VAZIOS.md`).  
4. **Assinatura ativa** só existe **depois** que a compra de teste **completa** (não basta digitar senha ao abrir a tela).

## 5. Confirmar no log

- **`getActiveSubscriptions` / `getAvailablePurchases` com `[]`:** normal se você **ainda não concluiu uma compra** com essa conta sandbox. Login na folha da Apple só autentica; a assinatura só existe após finalizar o fluxo de **Assinar**.
- Após uma compra concluída, espere `environmentIOS: "Sandbox"` (não `"Xcode"`).

Se os **planos** (preços) não carregaram: a primeira `fetchProducts` pode voltar **vazia** logo após o login sandbox (sessão da loja ainda não pronta). O app tenta de novo com `syncIOS` e pequenos atrasos; se continuar vazio, use **Atualizar loja agora** ou puxe para atualizar. Confirme também SKUs e contrato no App Store Connect (`SOLUCAO_IAP_IOS_PRODUTOS_VAZIOS.md`).

Se ainda aparecer **`Xcode`**: scheme local ou build antigo — repita o passo 1 e reinstale o app no aparelho.

## 6. Webhook (App Store Server Notifications)

- App Store Connect → seu app → **Notificações do servidor** (V2).
- URL de **Sandbox** apontando para a edge function (ex.: `…/functions/v1/activate-subscription`).
- O app já envia **`appAccountToken`** = UUID do usuário Supabase na compra (`assine-premium.tsx`).

## 7. Banco sem depender do webhook

O app chama a RPC **`sync_user_subscription_from_client`** após a compra. O webhook é complementar.

**Antes de publicar uma versão com assinatura:** no Supabase (SQL Editor, como `postgres`), aplique/atualize os scripts do repositório:

- `database/user_subscription_is_active_rpc.sql` — `user_subscription_is_active`, `any_users_have_active_subscription`, **`expire_stale_pending_subscriptions_for_user`** (expira `pending` após 1 dia sem confirmação; o app chama essa RPC ao abrir).
- `database/sync_user_subscription_from_client.sql` — sync pós-compra / reconcile.

Sem a função de expirar, o app ainda funciona, mas pendings antigos podem não ser fechados automaticamente no banco.

---

**Referência offline de preços:** o arquivo `MarcaAI.storekit` na pasta `ios/` fica só como documentação; não precisa estar no target. Para UI local rápida, você pode **temporariamente** escolher esse arquivo no Scheme (sabendo que aí não é sandbox real).
