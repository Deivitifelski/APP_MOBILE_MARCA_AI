import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatSocialTimeAgo } from '../../../lib/socialTime';
import type { SocialComment } from '../../../services/supabase/socialFeedService';

type Props = {
  comment: SocialComment;
  onLike?: (comment: SocialComment) => void;
  liking?: boolean;
};

export default function SocialCommentItem({ comment, onLike, liking = false }: Props) {
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
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {formatSocialTimeAgo(comment.created_at)}
          </Text>
          {comment.likes_count > 0 ? (
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {comment.likes_count === 1 ? '1 curtida' : `${comment.likes_count} curtidas`}
            </Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        onPress={() => onLike?.(comment)}
        disabled={!onLike || liking}
        hitSlop={10}
        style={styles.likeBtn}
        accessibilityLabel="Curtir comentário"
      >
        <Ionicons
          name={comment.liked_by_me ? 'heart' : 'heart-outline'}
          size={13}
          color={comment.liked_by_me ? '#EF4444' : colors.textSecondary}
        />
      </TouchableOpacity>
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
  },
  likeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
