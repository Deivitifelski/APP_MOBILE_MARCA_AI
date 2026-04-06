# iOS: planos sem preço / produtos “Indisponível” (expo-iap)

## Sintomas

Na tela **Assine Premium**, botões **Indisponível** ou **Valor indisponível** — `fetchProducts` não retornou os SKUs.

## IDs que o app pede

- `marcaai_mensal_app`
- `marcaai_anual_app`

Devem existir **exatamente** assim no **App Store Connect**, no app **`com.marcaai.app`**.

## Causas frequentes

| Causa | O que fazer |
|--------|-------------|
| **Build errado** | IAP real não roda no **Expo Go**. Use `expo run:ios` / Xcode / TestFlight. |
| **Bundle ID** | O binário precisa ser `com.marcaai.app` (como em `app.json`). |
| **ASC incompleto** | Assinatura com preço, localização (nome/descrição), grupo; contrato de apps pagos ativo. |
| **Debug com loja real** | Rodando sem `MarcaAI.storekit` no Scheme, a lista vem só da Apple — se o ASC não devolver, fica vazio. |
| **Debug com `.storekit`** | Com **StoreKit Configuration** no Run, preços vêm do arquivo local (útil no Xcode). |

## Conta Sandbox

A conta **Sandbox** da Apple é para a **compra na folha da App Store**, não substitui o login do app (Supabase). Ela **não** “liga” sozinha o catálogo: quem define os produtos é o **StoreKit + ASC** (ou o `.storekit` no debug).

## Padrão do repositório (sandbox real)

O scheme compartilhado **`MarcaAI`** está **sem** StoreKit Configuration no **Run**. Assim, ao dar ⌘R no Xcode no **iPhone físico**, a compra vai para a **Apple (sandbox)** e pode passar a aparecer em **App Store Connect → Sandbox → Última compra** (às vezes com atraso).

## Próximos passos

1. Confirmar SKUs e bundle no ASC e no código.  
2. **Product → Clean Build Folder** e rodar de novo no **dispositivo**.  
3. Na compra, usar a **conta sandbox** quando o iOS pedir (não use Apple ID de mídia da loja “de verdade” nessa folha).  
4. Se **só** quiser **preços na UI** sem falar com a Apple: **Edit Scheme → Run → Options** → **StoreKit Configuration** → escolher **`MarcaAI.storekit`** (aí **não** contabiliza no ASC).
