import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlatList, Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useActiveArtistContext } from '../../../contexts/ActiveArtistContext';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  alternarCurtidaSocialComentario,
  comentarSocialPost,
  listarComentariosSocialPost,
  type SocialComment,
  type SocialPost,
} from '../../../services/supabase/socialFeedService';
import SocialCommentComposer from './SocialCommentComposer';
import SocialCommentItem from './SocialCommentItem';

const SHEET_HEIGHT = Math.round(Dimensions.get('window').height * 0.75);
const DISMISS_DRAG = 110;
const DISMISS_VELOCITY = 900;

function friendlySocialError(error: string | null | undefined, fallback: string): string {
  if (!error) return fallback;
  const text = error.toLowerCase();
  if (
    text.includes('does not exist') ||
    text.includes('não existe') ||
    text.includes('could not find the function') ||
    text.includes('schema cache') ||
    text.includes('pgrst202')
  ) {
    return 'Rode database/FEED_SOCIAL_PATCH_CURTIDAS.sql no Supabase (SQL Editor) e tente de novo.';
  }
  if (text.includes('sem permissão')) {
    return 'Você precisa ser colaborador do artista ativo para curtir.';
  }
  return error;
}

type Props = {
  visible: boolean;
  post: SocialPost | null;
  onClose: () => void;
  onCommentsCountChange?: (postId: string, count: number) => void;
};

export default function SocialCommentsModal({
  visible,
  post,
  onClose,
  onCommentsCountChange,
}: Props) {
  const { colors } = useTheme();
  const { activeArtist } = useActiveArtistContext();
  const listRef = useRef<FlatList<SocialComment>>(null);
  const translateY = useSharedValue(0);
  const scrollY = useSharedValue(0);

  const [comments, setComments] = useState<SocialComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [likingCommentId, setLikingCommentId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const load = useCallback(async () => {
    if (!post?.id) return;
    setLoading(true);
    const { comments: list, error: err } = await listarComentariosSocialPost(
      post.id,
      activeArtist?.id
    );
    setComments(list);
    setError(err);
    setLoading(false);
    if (list.length > 0) scrollToEnd(false);
  }, [post?.id, activeArtist?.id, scrollToEnd]);

  useEffect(() => {
    if (!visible || !post?.id) return;
    translateY.value = 0;
    scrollY.value = 0;
    setMessage('');
    setError(null);
    void load();
  }, [visible, post?.id, load, translateY, scrollY]);

  const dismissModal = useCallback(() => {
    onClose();
  }, [onClose]);

  const finishDismiss = useCallback(
    (dy: number, vy: number) => {
      const shouldDismiss = dy > DISMISS_DRAG || vy > DISMISS_VELOCITY;

      if (shouldDismiss) {
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 220 }, (finished) => {
          if (finished) {
            runOnJS(dismissModal)();
          }
        });
        return;
      }

      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
    },
    [dismissModal, translateY]
  );

  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 2 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            translateY.value = gesture.dy;
          }
        },
        onPanResponderRelease: (_, gesture) => {
          finishDismiss(gesture.dy, gesture.vy);
        },
        onPanResponderTerminate: () => {
          translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
        },
      }),
    [finishDismiss, translateY]
  );

  const listScrollGesture = Gesture.Native();

  const dismissPanGesture = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-30, 30])
    .simultaneousWithExternalGesture(listScrollGesture)
    .onUpdate((event) => {
      if (scrollY.value <= 1 && event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (scrollY.value <= 1) {
        runOnJS(finishDismiss)(event.translationY, event.velocityY);
        return;
      }

      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const submit = async () => {
    if (!post?.id || !activeArtist?.id) {
      Alert.alert('Artista', 'Selecione um artista nas Configurações.');
      return;
    }

    const trimmed = message.trim();
    if (!trimmed || sending) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: SocialComment = {
      id: tempId,
      post_id: post.id,
      artist_id: activeArtist.id,
      artist_name: activeArtist.name,
      artist_image: activeArtist.profile_url ?? null,
      message: trimmed,
      created_at: new Date().toISOString(),
      likes_count: 0,
      liked_by_me: false,
    };

    const nextCount = comments.length + 1;
    setMessage('');
    setComments((prev) => [...prev, optimistic]);
    onCommentsCountChange?.(post.id, nextCount);
    scrollToEnd();
    setSending(true);

    const { success, error: err, commentId, commentsCount } = await comentarSocialPost({
      postId: post.id,
      artistaId: activeArtist.id,
      message: trimmed,
    });

    setSending(false);

    if (!success) {
      setComments((prev) => prev.filter((item) => item.id !== tempId));
      onCommentsCountChange?.(post.id, Math.max(0, nextCount - 1));
      Alert.alert(
        'Comentar',
        !err
          ? 'Não foi possível enviar o comentário.'
          : err.toLowerCase().includes('does not exist') ||
              err.toLowerCase().includes('could not find the function') ||
              err.toLowerCase().includes('pgrst202')
            ? 'Rode database/FEED_SOCIAL_PATCH_CURTIDAS.sql no Supabase e tente de novo.'
            : err
      );
      return;
    }

    if (commentsCount != null) {
      onCommentsCountChange?.(post.id, commentsCount);
    }

    if (commentId) {
      setComments((prev) =>
        prev.map((item) => (item.id === tempId ? { ...item, id: commentId } : item))
      );
    } else {
      await load();
      onCommentsCountChange?.(post.id, comments.length);
    }
  };

  const handleLikeComment = useCallback(
    async (comment: SocialComment) => {
      if (!activeArtist?.id || likingCommentId) return;
      if (comment.id.startsWith('temp-')) return;

      const prevLiked = comment.liked_by_me;
      const prevCount = comment.likes_count;
      const nextLiked = !prevLiked;
      const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

      setLikingCommentId(comment.id);
      setComments((prev) =>
        prev.map((item) =>
          item.id === comment.id
            ? { ...item, liked_by_me: nextLiked, likes_count: nextCount }
            : item
        )
      );

      const { success, error: err, liked, likesCount } = await alternarCurtidaSocialComentario({
        commentId: comment.id,
        artistaId: activeArtist.id,
      });

      setLikingCommentId(null);

      if (!success) {
        setComments((prev) =>
          prev.map((item) =>
            item.id === comment.id
              ? { ...item, liked_by_me: prevLiked, likes_count: prevCount }
              : item
          )
        );
        Alert.alert('Curtir', friendlySocialError(err, 'Não foi possível curtir.'));
        return;
      }

      setComments((prev) =>
        prev.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                liked_by_me: !!liked,
                likes_count: likesCount ?? nextCount,
              }
            : item
        )
      );
    },
    [activeArtist?.id, likingCommentId]
  );

  const renderItem = ({ item }: { item: SocialComment }) => (
    <SocialCommentItem
      comment={item}
      onLike={(comment) => void handleLikeComment(comment)}
      liking={likingCommentId === item.id}
    />
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar comentários" />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <GestureDetector gesture={dismissPanGesture}>
            <Animated.View
              style={[
                styles.sheet,
                sheetAnimatedStyle,
                {
                  backgroundColor: colors.background,
                  height: SHEET_HEIGHT,
                },
              ]}
            >
              <View {...handlePanResponder.panHandlers}>
                <View style={styles.handleWrap}>
                  <View style={[styles.handle, { backgroundColor: colors.border }]} />
                </View>

                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.headerTitle, { color: colors.text }]}>Comentários</Text>
                  <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {loading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <GestureDetector gesture={listScrollGesture}>
                  <FlatList
                    ref={listRef}
                    data={comments}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    style={styles.list}
                    contentContainerStyle={comments.length === 0 ? styles.emptyList : styles.listContent}
                    onScroll={(event) => {
                      scrollY.value = event.nativeEvent.contentOffset.y;
                    }}
                    scrollEventThrottle={16}
                    onContentSizeChange={() => {
                      if (comments.length > 0) scrollToEnd(false);
                    }}
                    ListEmptyComponent={
                      <View style={styles.empty}>
                        <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                          Nenhum comentário ainda
                        </Text>
                        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                          {error ? 'Não foi possível carregar.' : 'Comece a conversa.'}
                        </Text>
                      </View>
                    }
                  />
                </GestureDetector>
              )}

              <SocialCommentComposer
                value={message}
                onChangeText={setMessage}
                onSubmit={() => void submit()}
                sending={sending}
                artistName={activeArtist?.name}
                artistImage={activeArtist?.profile_url}
              />
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  keyboardWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    right: 12,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  emptyList: {
    flexGrow: 1,
    minHeight: 160,
  },
  center: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
});
