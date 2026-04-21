import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchLinkPreview, getDisplayHostname, type LinkPreviewResult } from '../lib/linkPreview';
import type { ArtistPressKitItem } from '../services/supabase/artistPressKitService';

type ThemeColors = {
  text: string;
  textSecondary: string;
  primary: string;
  error: string;
  border: string;
  surface: string;
};

type Props = {
  item: ArtistPressKitItem;
  colors: ThemeColors;
  /** Ex.: só administrador remove itens. */
  canDelete: boolean;
  /** Ex.: só administrador compartilha. */
  canShare: boolean;
  shareLoading?: boolean;
  onPressDelete: () => void;
  onPressShare: () => void;
};

export default function PressKitListItem({
  item,
  colors,
  canDelete,
  canShare,
  shareLoading = false,
  onPressDelete,
  onPressShare,
}: Props) {
  const [preview, setPreview] = useState<LinkPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(item.item_type === 'link');

  useEffect(() => {
    if (item.item_type !== 'link') {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    void fetchLinkPreview(item.url).then((res) => {
      if (!cancelled) {
        setPreview(res);
        setPreviewLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [item.item_type, item.url]);

  const displayTitle =
    item.item_type === 'link' && preview?.remoteTitle
      ? preview.remoteTitle
      : item.title;

  const hostname = item.item_type === 'link' ? getDisplayHostname(item.url) : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {item.item_type === 'link' && previewLoading ? (
        <View style={[styles.thumbPlaceholder, { backgroundColor: colors.border + '33' }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.thumbHint, { color: colors.textSecondary }]}>Carregando prévia…</Text>
        </View>
      ) : null}

      {item.item_type === 'link' && preview?.thumbnailUrl && !previewLoading ? (
        <TouchableOpacity activeOpacity={0.85} onPress={() => void Linking.openURL(item.url)}>
          <Image
            source={{ uri: preview.thumbnailUrl }}
            style={styles.thumb}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ) : null}

      {item.item_type === 'link' && !previewLoading && !preview?.thumbnailUrl ? (
        <View style={[styles.linkIconBanner, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="link-outline" size={28} color={colors.primary} />
          <Text style={[styles.linkHost, { color: colors.textSecondary }]} numberOfLines={1}>
            {hostname}
          </Text>
        </View>
      ) : null}

      {item.item_type === 'file' ? (
        <View style={[styles.fileBanner, { backgroundColor: colors.border + '22' }]}>
          <Ionicons name="document-attach-outline" size={28} color={colors.primary} />
          <Text style={[styles.fileLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            Arquivo enviado
          </Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={3}>
          {displayTitle}
        </Text>
        {item.item_type === 'link' && displayTitle !== item.title ? (
          <Text style={[styles.savedTitle, { color: colors.textSecondary }]} numberOfLines={1}>
            No app: {item.title}
          </Text>
        ) : null}
        <Text style={[styles.cardUrl, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.url}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.smallBtn, { borderColor: colors.border }]}
          onPress={() => void Linking.openURL(item.url)}
        >
          <Ionicons name="open-outline" size={16} color={colors.text} />
          <Text style={[styles.smallBtnText, { color: colors.text }]}>Abrir</Text>
        </TouchableOpacity>
        {canDelete ? (
          <TouchableOpacity
            style={[styles.smallBtn, { borderColor: colors.error + '66' }]}
            onPress={onPressDelete}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={[styles.smallBtnText, { color: colors.error }]}>Excluir</Text>
          </TouchableOpacity>
        ) : null}
        {canShare ? (
          <TouchableOpacity
            style={[styles.iconOnlyBtn, { borderColor: colors.primary + '66' }]}
            onPress={onPressShare}
            disabled={shareLoading}
            hitSlop={8}
          >
            {shareLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="share-social-outline" size={17} color={colors.primary} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  thumbPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  thumbHint: {
    fontSize: 13,
    marginTop: 4,
  },
  linkIconBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  linkHost: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  fileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  fileLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    padding: 14,
    paddingTop: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  savedTitle: {
    fontSize: 12,
    marginTop: 4,
  },
  cardUrl: {
    fontSize: 13,
    marginTop: 6,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  iconOnlyBtn: {
    width: 34,
    height: 34,
    marginLeft: 'auto',
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
