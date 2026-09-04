import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveArtistContext } from "../../contexts/ActiveArtistContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
    addSocialPostComment,
    createSocialPost,
    deleteSocialPost,
    fetchLikedPostIds,
    fetchSocialFeed,
    fetchSocialPostComments,
    subscribeToSocialFeed,
    toggleSocialPostLike,
    uploadFeedMediaToStorage,
    type SocialPostComment,
} from "../../services/supabase/socialFeedService";

type Post = {
  id: string;
  artistId: string;
  artistName: string;
  avatar: string;
  time: string;
  text: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  isUploading?: boolean;
  tags: string[];
  likes: number;
  comments: number;
  shares: number;
  location?: string;
};

function formatCompact(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(".0", "")}k`;
  }
  return `${value}`;
}

function FeedVideo({
  uri,
  aspectRatio,
  composerVisible,
}: {
  uri: string;
  aspectRatio: number;
  composerVisible: boolean;
}) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (composerVisible && !isMuted) {
      player.muted = true;
      setIsMuted(true);
    }
  }, [composerVisible, isMuted, player]);

  return (
    <View style={[styles.feedVideo, { aspectRatio: Math.max(aspectRatio, 1) }]}>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={0.92}
        onPress={() => {
          if (isPlaying) {
            player.pause();
            setIsPlaying(false);
          } else {
            player.play();
            setIsPlaying(true);
          }
        }}
      >
        <VideoView
          player={player}
          style={styles.feedVideoPlayer}
          contentFit="cover"
          nativeControls={false}
        />
      </TouchableOpacity>
      {!isPlaying ? (
        <View pointerEvents="none" style={styles.playButton}>
          <Ionicons name="play" size={18} color="#ffffff" />
        </View>
      ) : null}
      <TouchableOpacity
        accessibilityLabel={isMuted ? "Ativar som do vídeo" : "Silenciar vídeo"}
        style={styles.muteButton}
        onPress={() => {
          const nextMuted = !isMuted;
          player.muted = nextMuted;
          setIsMuted(nextMuted);
        }}
      >
        <Ionicons
          name={isMuted ? "volume-mute" : "volume-high"}
          size={18}
          color="#ffffff"
        />
      </TouchableOpacity>
    </View>
  );
}

export default function SocialFeedScreen() {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeArtist } = useActiveArtistContext();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const loadingMoreRef = useRef(false);
  const [composerVisible, setComposerVisible] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerLocation, setComposerLocation] = useState("");
  const [selectedMediaUri, setSelectedMediaUri] = useState<string | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<"image" | "video">(
    "image",
  );
  const [mediaAspectRatios, setMediaAspectRatios] = useState<
    Record<string, number>
  >({});
  const [previewAspectRatio, setPreviewAspectRatio] = useState(1);
  const [composerError, setComposerError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [postComments, setPostComments] = useState<SocialPostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSending, setCommentSending] = useState(false);

  const resetComposer = useCallback(() => {
    setComposerText("");
    setComposerLocation("");
    setSelectedMediaUri(null);
    setSelectedMediaType("image");
    setComposerError("");
  }, []);

  const loadPosts = useCallback(
    async (reset = false) => {
      try {
        if (reset) {
          setLoading(true);
        } else {
          if (loadingMoreRef.current || !hasMorePosts) return;
          loadingMoreRef.current = true;
          setLoadingMore(true);
        }

        const offset = reset ? 0 : posts.length;
        const { posts: nextPosts, error } = await fetchSocialFeed(20, offset);
        if (error) {
          console.error("Erro ao buscar feed:", error);
          return;
        }
        setPosts((currentPosts) =>
          reset ? nextPosts : [...currentPosts, ...nextPosts],
        );
        setHasMorePosts(nextPosts.length === 20);
        if (reset && activeArtist) {
          const likedResult = await fetchLikedPostIds(
            activeArtist.id,
            nextPosts.map((post) => post.id),
          );
          if (!likedResult.error) {
            setLikedPosts(new Set(likedResult.postIds));
          }
        }
      } catch (error) {
        console.error("Erro inesperado no feed:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        if (!reset) loadingMoreRef.current = false;
      }
    },
    [activeArtist, hasMorePosts, posts.length],
  );

  useEffect(() => {
    loadPosts(true);
  }, []);

  const latestLoadPosts = useRef(loadPosts);
  useEffect(() => {
    latestLoadPosts.current = loadPosts;
  }, [loadPosts]);

  useEffect(() => {
    const unsubscribe = subscribeToSocialFeed(() => {
      latestLoadPosts.current(true);
    });
    return unsubscribe;
  }, []);

  const postIdsKey = posts.map((post) => post.id).join(",");

  useEffect(() => {
    if (!activeArtist || !postIdsKey) return;

    let cancelled = false;
    fetchLikedPostIds(activeArtist.id, postIdsKey.split(",")).then((result) => {
      if (!cancelled && !result.error) {
        setLikedPosts(new Set(result.postIds));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeArtist, postIdsKey]);

  const loadMorePosts = useCallback(() => {
    if (loadingMore || loading || !hasMorePosts || loadingMoreRef.current) {
      return;
    }
    loadPosts(false);
  }, [loadingMore, loading, loadPosts]);

  const handleLike = useCallback(
    async (postId: string) => {
      if (!activeArtist) return;

      const wasLiked = likedPosts.has(postId);
      setLikedPosts((current) => {
        const next = new Set(current);
        if (wasLiked) next.delete(postId);
        else next.add(postId);
        return next;
      });
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, likes: Math.max(0, post.likes + (wasLiked ? -1 : 1)) }
            : post,
        ),
      );

      const result = await toggleSocialPostLike({
        postId,
        artistId: activeArtist.id,
        liked: wasLiked,
      });
      if (!result.success) {
        setLikedPosts((current) => {
          const next = new Set(current);
          if (wasLiked) next.add(postId);
          else next.delete(postId);
          return next;
        });
        setPosts((current) =>
          current.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  likes: Math.max(0, post.likes + (wasLiked ? 1 : -1)),
                }
              : post,
          ),
        );
        Alert.alert(
          "Erro",
          result.error || "Não foi possível atualizar a curtida.",
        );
      }
    },
    [activeArtist, likedPosts],
  );

  const handleShare = useCallback(async (post: Post) => {
    try {
      await Share.share({
        message: `${post.artistName}\n${post.text}\n${post.location ? `📍 ${post.location}` : ""}`,
        title: post.artistName,
        url: post.mediaUrl || undefined,
      });
    } catch (error) {
      console.error("Erro ao compartilhar:", error);
    }
  }, []);

  const handleDeletePost = useCallback(
    (post: Post) => {
      if (!activeArtist || post.artistId !== activeArtist.id) return;

      Alert.alert("Excluir postagem?", "Essa ação não pode ser desfeita.", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setDeletingPostId(post.id);
            const result = await deleteSocialPost({
              postId: post.id,
              artistId: activeArtist.id,
            });
            setDeletingPostId(null);

            if (!result.success) {
              Alert.alert(
                "Erro ao excluir",
                result.error || "Não foi possível excluir a postagem.",
              );
              return;
            }

            setPosts((current) =>
              current.filter((item) => item.id !== post.id),
            );
          },
        },
      ]);
    },
    [activeArtist],
  );

  const handleOpenComments = useCallback(async (postId: string) => {
    setSelectedPostId(postId);
    setPostComments([]);
    setCommentsVisible(true);
    setCommentsLoading(true);
    const result = await fetchSocialPostComments(postId);
    setCommentsLoading(false);
    if (result.error) {
      Alert.alert("Erro", result.error);
      return;
    }
    setPostComments(result.comments);
  }, []);

  const handleAddComment = useCallback(async () => {
    if (!activeArtist || !selectedPostId || !commentText.trim()) {
      if (!commentText.trim()) {
        Alert.alert("Aviso", "Escreva um comentário antes de enviar.");
      }
      return;
    }

    setCommentSending(true);
    const result = await addSocialPostComment({
      postId: selectedPostId,
      artistId: activeArtist.id,
      message: commentText,
    });
    setCommentSending(false);
    if (!result.success) {
      Alert.alert(
        "Erro",
        result.error || "Não foi possível enviar o comentário.",
      );
      return;
    }

    setCommentText("");
    const refreshedComments = await fetchSocialPostComments(selectedPostId);
    if (!refreshedComments.error) {
      setPostComments(refreshedComments.comments);
      setPosts((current) =>
        current.map((post) =>
          post.id === selectedPostId
            ? { ...post, comments: post.comments + 1 }
            : post,
        ),
      );
    }
  }, [activeArtist, commentText, selectedPostId]);

  const handlePickMedia = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Precisamos acessar suas fotos e vídeos para publicar um post.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 0.8,
        videoMaxDuration: 60,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      setSelectedMediaType(asset.type === "video" ? "video" : "image");
      setSelectedMediaUri(asset.uri);
      setComposerError("");
    } catch (error) {
      console.error("Erro ao selecionar mídia:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage.includes("PHPPhotosErrorDomain") ||
        errorMessage.includes("3164")
      ) {
        try {
          const fileResult = await DocumentPicker.getDocumentAsync({
            type: "video/*",
            copyToCacheDirectory: true,
            multiple: false,
          });
          const file = fileResult.assets?.[0];
          if (!fileResult.canceled && file) {
            setSelectedMediaType("video");
            setSelectedMediaUri(file.uri);
            setComposerError("");
            return;
          }
        } catch (fallbackError) {
          console.error(
            "Erro ao selecionar vídeo pelos Arquivos:",
            fallbackError,
          );
        }
      }

      Alert.alert(
        "Erro",
        "Não foi possível acessar esse vídeo pelo Fotos. Tente selecioná-lo pelo app Arquivos.",
      );
    }
  }, []);

  const handlePublish = useCallback(async () => {
    if (!activeArtist) {
      setComposerError("Selecione um artista antes de publicar.");
      return;
    }

    if (!composerText.trim() && !selectedMediaUri) {
      setComposerError("Escreva algo ou adicione uma mídia antes de publicar.");
      return;
    }

    setComposerError("");
    setIsPublishing(true);

    try {
      let uploadedMediaUrl: string | undefined;
      if (selectedMediaUri) {
        const uploadResult = await uploadFeedMediaToStorage(
          selectedMediaUri,
          `${activeArtist.id}-feed`,
        );
        if (!uploadResult.success || !uploadResult.url) {
          throw new Error(uploadResult.error || "Falha no envio da mídia.");
        }
        uploadedMediaUrl = uploadResult.url;
      }

      const result = await createSocialPost({
        artistId: activeArtist.id,
        text: composerText.trim(),
        location: composerLocation.trim() || null,
        media: uploadedMediaUrl
          ? [
              {
                media_type: selectedMediaType,
                media_url: uploadedMediaUrl,
                thumbnail_url:
                  selectedMediaType === "video" ? uploadedMediaUrl : null,
              },
            ]
          : [],
        tags: [],
      });

      if (!result.success) {
        throw new Error(result.error || "Erro ao publicar o post.");
      }

      resetComposer();
      setComposerVisible(false);
      await loadPosts(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível publicar este post.";
      setComposerError(message);
      Alert.alert("Erro ao publicar", message);
    } finally {
      setIsPublishing(false);
    }
  }, [
    activeArtist,
    composerLocation,
    composerText,
    loadPosts,
    resetComposer,
    selectedMediaType,
    selectedMediaUri,
  ]);

  const renderPost = ({ item }: { item: Post }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.postHeader}>
        <View style={styles.authorWrap}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          <View style={styles.authorTextWrap}>
            <Text style={[styles.artistName, { color: colors.text }]}>
              {item.artistName}
            </Text>
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {item.time}
            </Text>
          </View>
        </View>

        {item.artistId !== activeArtist?.id ? (
          <TouchableOpacity
            style={[styles.followButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.followText}>Seguir</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            accessibilityLabel="Opções da postagem"
            disabled={deletingPostId === item.id}
            style={styles.postMenuButton}
            onPress={() => handleDeletePost(item)}
          >
            {deletingPostId === item.id ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={colors.textSecondary}
              />
            )}
          </TouchableOpacity>
        )}
      </View>

      {item.location ? (
        <View style={styles.locationRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={[styles.locationText, { color: colors.textSecondary }]}>
            {item.location}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.postText, { color: colors.text }]}>{item.text}</Text>

      {item.tags.length > 0 ? (
        <View style={styles.tagsWrap}>
          {item.tags.map((tag) => (
            <Text
              key={`${item.id}-${tag}`}
              style={[styles.tag, { color: colors.primary }]}
            >
              {tag}
            </Text>
          ))}
        </View>
      ) : null}

      {item.mediaUrl?.trim() ? (
        <View style={styles.mediaWrap}>
          {item.mediaType === "video" ? (
            <View
              style={[
                styles.mediaPlaceholder,
                { backgroundColor: isDarkMode ? "#111827" : "#e5e7eb" },
              ]}
            >
              <FeedVideo
                uri={item.mediaUrl}
                aspectRatio={mediaAspectRatios[item.id] || 1}
                composerVisible={composerVisible}
              />
            </View>
          ) : (
            <Image
              source={{ uri: item.mediaUrl }}
              style={[
                styles.mediaImage,
                { aspectRatio: mediaAspectRatios[item.id] || 1 },
              ]}
              onLoad={(event) => {
                const { width, height } = event.nativeEvent.source;
                if (width && height) {
                  setMediaAspectRatios((current) => ({
                    ...current,
                    [item.id]: width / height,
                  }));
                }
              }}
              resizeMode="contain"
            />
          )}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Ionicons
            name={likedPosts.has(item.id) ? "heart" : "heart-outline"}
            size={20}
            color={likedPosts.has(item.id) ? "#ef4444" : colors.textSecondary}
          />
          <Text
            style={[
              styles.actionText,
              {
                color: likedPosts.has(item.id)
                  ? "#ef4444"
                  : colors.textSecondary,
              },
            ]}
          >
            {formatCompact(item.likes)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleOpenComments(item.id)}
        >
          <Ionicons
            name="chatbubble-outline"
            size={20}
            color={colors.textSecondary}
          />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>
            {formatCompact(item.comments)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShare(item)}
        >
          <Ionicons
            name="share-social-outline"
            size={20}
            color={colors.textSecondary}
          />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>
            {formatCompact(item.shares)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const emptyState = (
    <View style={styles.emptyWrap}>
      <Ionicons name="sparkles-outline" size={34} color={colors.primary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Ainda não há posts no feed
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Quando artistas publicarem conteúdo, ele aparecerá aqui.
      </Text>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 8 },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.heading, { color: colors.text }]}>
            Descobrir
          </Text>
          <Text style={[styles.subheading, { color: colors.textSecondary }]}>
            Feed geral de artistas
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/adicionar-postagem")}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.createText}>Postar</Text>
        </TouchableOpacity>
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderPost}
          onEndReached={loadMorePosts}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={emptyState}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        transparent
        visible={composerVisible}
        animationType="slide"
        onRequestClose={() => setComposerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={styles.keyboardAvoiding}
          >
            <View
              style={[
                styles.composerSheet,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.composerHeader}>
                <Text style={[styles.composerTitle, { color: colors.text }]}>
                  Novo post
                </Text>
                <TouchableOpacity onPress={() => setComposerVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.composerScroll}
                contentContainerStyle={styles.composerContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                automaticallyAdjustKeyboardInsets
              >
                <View style={styles.composerArtistRow}>
                  <Image
                    source={{
                      uri:
                        activeArtist?.profile_url ||
                        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
                    }}
                    style={styles.composerAvatar}
                  />
                  <Text style={[styles.composerArtist, { color: colors.text }]}>
                    {activeArtist?.name || "Selecione um artista"}
                  </Text>
                </View>

                {selectedMediaUri ? (
                  <View style={styles.previewWrap}>
                    <View
                      style={[
                        styles.previewContainer,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: selectedMediaUri }}
                        style={[
                          styles.previewImage,
                          { aspectRatio: previewAspectRatio },
                        ]}
                        onLoad={(event) => {
                          const { width, height } = event.nativeEvent.source;
                          if (width && height)
                            setPreviewAspectRatio(width / height);
                        }}
                        resizeMode="contain"
                      />
                      {selectedMediaType === "video" && (
                        <View style={styles.playButtonSmall}>
                          <Ionicons name="play" size={18} color="#fff" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.changeMediaButton}
                        onPress={handlePickMedia}
                      >
                        <Ionicons
                          name="images-outline"
                          size={16}
                          color="#fff"
                        />
                        <Text style={styles.changeMediaText}>Trocar</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.removeMediaButton}
                      onPress={() => setSelectedMediaUri(null)}
                    >
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
                      <Text style={styles.removeMediaText}>Remover mídia</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.mediaPicker,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handlePickMedia}
                  >
                    <View style={styles.mediaPickerIcon}>
                      <Ionicons
                        name="images-outline"
                        size={26}
                        color={colors.primary}
                      />
                    </View>
                    <Text
                      style={[styles.mediaPickerTitle, { color: colors.text }]}
                    >
                      Adicionar foto ou vídeo
                    </Text>
                    <Text
                      style={[
                        styles.mediaPickerSubtitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Mostre seu trabalho para quem acompanha você
                    </Text>
                  </TouchableOpacity>
                )}

                <TextInput
                  value={composerText}
                  onChangeText={setComposerText}
                  placeholder="Compartilhe uma novidade, show ou clipe..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  style={[
                    styles.composerInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                />

                <TextInput
                  value={composerLocation}
                  onChangeText={setComposerLocation}
                  placeholder="Localização (opcional)"
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.composerInputSmall,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                />

                {composerError ? (
                  <Text style={styles.errorText}>{composerError}</Text>
                ) : null}
              </ScrollView>

              <View style={styles.composerActions}>
                <TouchableOpacity
                  style={[
                    styles.mediaButton,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={handlePickMedia}
                >
                  <Ionicons
                    name="image-outline"
                    size={18}
                    color={colors.text}
                  />
                  <Text
                    style={[styles.mediaButtonText, { color: colors.text }]}
                  >
                    Alterar mídia
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isPublishing || !activeArtist}
                  style={[
                    styles.publishButton,
                    {
                      backgroundColor: activeArtist
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                  onPress={handlePublish}
                >
                  {isPublishing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.publishButtonText}>Publicar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        transparent
        visible={commentsVisible}
        animationType="slide"
        onRequestClose={() => setCommentsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={styles.commentsKeyboardAvoiding}
          >
            <View
              style={[
                styles.commentsSheet,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.commentsHeader}>
                <Text style={[styles.commentsTitle, { color: colors.text }]}>
                  Comentários
                </Text>
                <TouchableOpacity onPress={() => setCommentsVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {commentsLoading ? (
                <View style={styles.commentPlaceholder}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={postComments}
                  keyExtractor={(comment) => comment.id}
                  style={styles.commentsListContainer}
                  contentContainerStyle={styles.commentsList}
                  keyboardShouldPersistTaps="handled"
                  automaticallyAdjustKeyboardInsets
                  ListEmptyComponent={
                    <View style={styles.commentPlaceholder}>
                      <Ionicons
                        name="chatbubble-outline"
                        size={40}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.commentPlaceholderText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Nenhum comentário ainda
                      </Text>
                    </View>
                  }
                  renderItem={({ item: comment }) => (
                    <View style={styles.commentItem}>
                      <Image
                        source={{ uri: comment.avatar }}
                        style={styles.commentAvatar}
                      />
                      <View style={styles.commentBody}>
                        <Text
                          style={[styles.commentAuthor, { color: colors.text }]}
                        >
                          {comment.artistName}
                        </Text>
                        <Text
                          style={[
                            styles.commentMessage,
                            { color: colors.text },
                          ]}
                        >
                          {comment.message}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              )}

              <View style={styles.commentInputContainer}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Escreva um comentário..."
                  placeholderTextColor={colors.textSecondary}
                  style={[
                    styles.commentInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <TouchableOpacity
                  disabled={commentSending}
                  style={[
                    styles.sendCommentButton,
                    {
                      backgroundColor: commentSending
                        ? colors.border
                        : colors.primary,
                    },
                  ]}
                  onPress={handleAddComment}
                >
                  {commentSending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  heading: {
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
  },
  subheading: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: "400",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  createText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authorWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  authorTextWrap: {
    marginLeft: 10,
  },
  artistName: {
    fontSize: 17,
    fontWeight: "800",
  },
  metaText: {
    fontSize: 12,
    marginTop: 2,
  },
  followButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  followText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  postMenuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 5,
  },
  locationText: {
    fontSize: 12,
    fontWeight: "500",
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    fontWeight: "500",
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 8,
  },
  tag: {
    fontSize: 13,
    fontWeight: "700",
  },
  mediaWrap: {
    marginTop: 12,
    marginHorizontal: 4,
    padding: 6,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#eef0f4",
  },
  mediaImage: {
    width: "100%",
    alignSelf: "center",
    borderRadius: 12,
    backgroundColor: "#eef0f4",
  },
  mediaPlaceholder: {
    position: "relative",
    width: "100%",
    alignSelf: "center",
    borderRadius: 12,
    overflow: "hidden",
  },
  feedVideo: {
    width: "100%",
    alignSelf: "center",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111827",
  },
  feedVideoPlayer: {
    ...StyleSheet.absoluteFillObject,
  },
  playButton: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 52,
    height: 52,
    transform: [{ translateX: -26 }, { translateY: -26 }],
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  muteButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  uploadingText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 52,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },
  footerLoading: {
    paddingVertical: 18,
    alignItems: "center",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  keyboardAvoiding: {
    width: "100%",
    justifyContent: "flex-end",
  },
  composerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 18,
    paddingBottom: 16,
    maxHeight: "88%",
  },
  composerContent: {
    paddingBottom: 18,
  },
  composerScroll: {
    flexShrink: 1,
  },
  composerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  composerTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  composerLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  composerArtist: {
    fontSize: 16,
    fontWeight: "700",
  },
  composerArtistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  composerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  composerInput: {
    minHeight: 86,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
    marginBottom: 12,
    fontSize: 15,
  },
  composerInputSmall: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  previewWrap: {
    marginBottom: 14,
  },
  previewContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#eef0f4",
  },
  previewImage: {
    width: "100%",
    backgroundColor: "#eef0f4",
  },
  playButtonSmall: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 46,
    height: 46,
    transform: [{ translateX: -23 }, { translateY: -23 }],
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeMediaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
  },
  removeMediaText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
  changeMediaButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  changeMediaText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  mediaPicker: {
    minHeight: 156,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  mediaPickerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    marginBottom: 10,
  },
  mediaPickerTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  mediaPickerSubtitle: {
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },
  composerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  mediaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  mediaButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  publishButton: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  publishButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    marginBottom: 12,
    fontWeight: "600",
  },
  commentsSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 18,
    paddingBottom: 16,
    maxHeight: "85%",
    flex: 1,
    flexDirection: "column",
  },
  commentsKeyboardAvoiding: {
    flex: 1,
    justifyContent: "flex-end",
  },
  commentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  commentsTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  commentsListContainer: {
    flex: 1,
    marginBottom: 12,
  },
  commentsList: {
    paddingBottom: 12,
    flexGrow: 1,
  },
  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  commentBody: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 3,
  },
  commentMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  commentPlaceholderText: {
    fontSize: 16,
    marginTop: 12,
    fontWeight: "500",
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  commentInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 80,
  },
  sendCommentButton: {
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
