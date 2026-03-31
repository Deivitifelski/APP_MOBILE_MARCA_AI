/**
 * Celular BR: (XX) XXXXX-XXXX — 11 dígitos (DDD + número).
 */

export function maskBrazilMobile(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function brazilMobileDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

/** Permite enviar só se vazio ou número completo (11 dígitos). */
export function isEmptyOrCompleteBrazilMobile(value: string): boolean {
  const d = brazilMobileDigits(value);
  return d.length === 0 || d.length === 11;
}

export function isCompleteBrazilMobile(value: string): boolean {
  return brazilMobileDigits(value).length === 11;
}

/**
 * URL do WhatsApp (wa.me). Aceita texto com ou sem máscara.
 * Retorna null se não houver dígitos suficientes para abrir o app.
 */
export function buildWhatsAppUrl(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return `https://wa.me/55${d}`;
  if (d.length >= 12 && d.startsWith('55')) return `https://wa.me/${d}`;
  return null;
}
