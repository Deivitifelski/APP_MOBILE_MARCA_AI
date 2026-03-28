/**
 * Máscara de Real brasileiro ao digitar (centavos entram pela direita),
 * igual ao campo "Valor (R$)" em adicionar/editar evento.
 */
export function formatCurrencyBRLInput(value: string): string {
  const numericValue = value.replace(/\D/g, '');
  if (!numericValue) return '';
  const limitedValue = numericValue.slice(0, 11);
  const amount = parseInt(limitedValue, 10) / 100;
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Valor numérico em string a partir do texto mascarado (reais). */
export function extractNumericValueString(formattedValue: string): string {
  const numericValue = formattedValue.replace(/\D/g, '');
  return numericValue ? (parseInt(numericValue, 10) / 100).toString() : '';
}

/** Valor já salvo em reais → texto do input mascarado. */
export function formatCurrencyBRLFromAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const cents = Math.round(amount * 100);
  const capped = Math.min(Math.max(0, cents), 99999999999);
  return formatCurrencyBRLInput(String(capped));
}
