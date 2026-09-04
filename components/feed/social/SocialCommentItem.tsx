import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatSocialTimeAgo } from '../../../lib/socialTime';
import type { SocialComment } from '../../../services/supabase/socialFeedService';

type Props = {
  comment: SocialComment;
};

export default function SocialCommentItem({ comment }: Props) {
  const { colors } = useTheme();
  const displayName = comment.artist_name;
  const avatarUrl = comment.artist_image?.trim() || '';
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.row}>
      <View style={[styles.avatarWrap, { backgroundColor: colors.secondary }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <Text style={[styles.avatarInitial, { color: colors.primary }]}>{initial}</Text>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.message, { color: colors.text }]}>
          <Text style={styles.name}>{displayName}</Text>
          {'  '}
          {comment.message}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {formatSocialTimeAgo(comment.created_at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: 14,
    lineHeight: 19,
  },
  name: {
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
});
