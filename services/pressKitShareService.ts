import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Share } from 'react-native';
import { getCurrentUser } from './supabase/authService';
import { buildPressKitShareMessage } from './supabase/artistPressKitService';
import type { ArtistPressKitItem } from './supabase/artistPressKitService';

function extensionFromUrl(url: string): string {
  const clean = url.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  if (ext && /^[a-z0-9]{1,8}$/.test(ext)) return ext;
  return 'bin';
}

function mimeFromUrl(url: string): string {
  const low = url.split('?')[0].toLowerCase();
  if (low.endsWith('.pdf')) return 'application/pdf';
  if (low.endsWith('.png')) return 'image/png';
  if (low.endsWith('.jpg') || low.endsWith('.jpeg')) return 'image/jpeg';
  if (low.endsWith('.webp')) return 'image/webp';
  if (low.endsWith('.gif')) return 'image/gif';
  if (low.endsWith('.heic')) return 'image/heic';
  if (low.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compartilha o press kit: mensagem com links (URLs) + lista de arquivos sem URL;
 * em seguida abre o compartilhamento nativo de cada arquivo (documento) após baixar para o cache.
 */
export async function sharePressKitItems(artistLabel: string, items: ArtistPressKitItem[]): Promise<void> {
  const { user } = await getCurrentUser();
  if (!user) {
    Alert.alert('Sessão', 'Faça login novamente para compartilhar.');
    return;
  }

  const title = `Press kit — ${(artistLabel || '').trim() || 'Artista'}`;
  const files = items.filter((i) => i.item_type === 'file');
  const links = items.filter((i) => i.item_type === 'link');
  const message = buildPressKitShareMessage(artistLabel, items);

  // Quando há arquivos, evita abrir um share inicial só com texto.
  // O texto é enviado apenas se a seleção tiver somente links.
  if (files.length === 0 && links.length > 0) {
    try {
      await Share.share({ message, title });
    } catch {
      Alert.alert('Compartilhar', message);
    }
  }

  if (files.length === 0) return;

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    Alert.alert(
      'Arquivos',
      'Este dispositivo não suporta enviar os arquivos diretamente. Abra cada item no app e use Abrir.'
    );
    return;
  }

  await sleep(350);

  for (const fileItem of files) {
    try {
      const ext = extensionFromUrl(fileItem.url);
      const baseDir = FileSystem.cacheDirectory ?? '';
      const localUri = `${baseDir}press_kit_${fileItem.id}_${Date.now()}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(fileItem.url, localUri);
      await Sharing.shareAsync(uri, {
        mimeType: mimeFromUrl(fileItem.url),
        dialogTitle: fileItem.title,
      });
      await sleep(400);
    } catch {
      Alert.alert(
        'Arquivo',
        `Não foi possível compartilhar o arquivo "${fileItem.title}". Tente abrir pelo app.`
      );
    }
  }
}
