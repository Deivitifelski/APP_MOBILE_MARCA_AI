/**
 * Desabilita logs verbosos para evitar exposição de IDs e dados sensíveis.
 * Mantém apenas console.error disponível.
 */
const disableLogs = () => {
  if (typeof console === 'undefined') {
    return;
  }

  const noop = () => undefined;

  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
};

disableLogs();


