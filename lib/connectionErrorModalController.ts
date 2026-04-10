export type ConnectionErrorModalOptions = {
  /** Se definido, exibe o botão secundário "Tentar novamente". */
  onRetry?: () => void;
};

type Listener = (opts: ConnectionErrorModalOptions | undefined) => void;

let listener: Listener | null = null;

export function registerConnectionErrorModal(fn: Listener | null) {
  listener = fn;
}

export function showConnectionErrorModal(opts?: ConnectionErrorModalOptions) {
  listener?.(opts);
}
