import { showConnectionErrorModal, type ConnectionErrorModalOptions } from '../lib/connectionErrorModalController';
import { isLikelyNetworkFailure } from './isLikelyNetworkFailure';

/**
 * Se o erro parece falha de rede/timeout, abre o modal global de conexão.
 * @returns true se o modal foi exibido (caller deve retornar / não mostrar outro alerta).
 */
export function maybeShowConnectionError(
  error: unknown,
  message?: string | null,
  opts?: ConnectionErrorModalOptions,
): boolean {
  if (!isLikelyNetworkFailure(error, message)) {
    return false;
  }
  showConnectionErrorModal(opts);
  return true;
}
