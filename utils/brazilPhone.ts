/**
 * Celular BR: (XX) XXXXX-XXXX — 11 dígitos (DDD + número).
 */

import { Alert, Linking } from 'react-native';

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

export async function openWhatsAppConversation(
  phone: string | null | undefined,
  onInvalid?: () => void
): Promise<void> {
  const url = buildWhatsAppUrl(phone);
  if (!url) {
    if (onInvalid) {
      onInvalid();
      return;
    }
    Alert.alert('WhatsApp indisponível', 'Número de WhatsApp inválido.');
    return;
  }
  const digits = String(phone || '').replace(/\D/g, '');
  const phoneIntl = digits.startsWith('55') ? digits : `55${digits}`;
  const appUrl = `whatsapp://send?phone=${phoneIntl}`;
  const webUrl = `https://api.whatsapp.com/send?phone=${phoneIntl}`;
  try {
    await Linking.openURL(appUrl);
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        Alert.alert('Erro', 'Não foi possível abrir a conversa no WhatsApp.');
      }
    }
  }
}
