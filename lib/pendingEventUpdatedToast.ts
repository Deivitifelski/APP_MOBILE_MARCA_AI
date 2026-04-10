/**
 * Mensagem exibida em TransientToast ao voltar de editar-evento (router.back).
 * Evita router.replace na pilha, que parece “avançar” em vez de voltar.
 */
let pendingMessage: string | null = null;

export function setPendingEventUpdatedToast(message: string): void {
  pendingMessage = message.trim() || null;
}

export function consumePendingEventUpdatedToast(): string | null {
  const m = pendingMessage;
  pendingMessage = null;
  return m;
}
