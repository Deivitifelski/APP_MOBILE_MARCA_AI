import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveArtistContext } from "../contexts/ActiveArtistContext";
import { useTheme } from "../contexts/ThemeContext";
import {
    createSocialPost,
    uploadFeedMediaToStorage,
} from "../services/supabase/socialFeedService";

function PostMediaPreview({
  uri,
  type,
}: {
  uri: string;
  type: "image" | "video";
}) {
  const player = useVideoPlayer(
    type === "video" ? uri : null,
    (videoPlayer) => {
      videoPlayer.loop = true;
      videoPlayer.muted = true;
    },
  );
  const [isPlaying, setIsPlaying] = useState(false);

  if (type === "image") {
    return (
      <Image
        source={{ uri }}
        style={styles.previewImage}
        resizeMode="contain"
      />
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.videoPreview}
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
        style={styles.previewImage}
        contentFit="contain"
        nativeControls={false}
      />
      {!isPlaying ? (
        <View pointerEvents="none" style={styles.play}>
          <Ionicons name="play" size={20} color="#fff" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function AddSocialPostScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeArtist } = useActiveArtistContext();
  const contentScrollRef = useRef<ScrollView>(null);
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const keepInputVisible = useCallback(() => {
    setTimeout(() => {
      contentScrollRef.current?.scrollTo({ y: 120, animated: true });
    }, 350);
  }, []);

  React.useEffect(() => {
    const keyboardSubscription = Keyboard.addListener("keyboardDidShow", () => {
      contentScrollRef.current?.scrollTo({ y: 120, animated: true });
    });
    return () => keyboardSubscription.remove();
  }, []);

  const pickMedia = useCallback(async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à galeria para adicionar uma mídia.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setMediaUri(asset.uri);
        setMediaType(asset.type === "video" ? "video" : "image");
        setError("");
      }
    } catch (selectionError) {
      const message =
        selectionError instanceof Error
          ? selectionError.message
          : String(selectionError);
      if (
        message.includes("PHPPhotosErrorDomain") ||
        message.includes("3164")
      ) {
        const result = await DocumentPicker.getDocumentAsync({
          type: "video/*",
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets?.[0]) {
          setMediaUri(result.assets[0].uri);
          setMediaType("video");
          setError("");
          return;
        }
      }
      Alert.alert("Erro", "Não foi possível selecionar essa mídia.");
    }
  }, []);

  const publish = useCallback(async () => {
    if (!activeArtist) {
      setError("Selecione um artista antes de publicar.");
      return;
    }
    if (!text.trim() && !mediaUri) {
      setError("Escreva algo ou adicione uma mídia antes de publicar.");
      return;
    }

    setPublishing(true);
    setError("");
    try {
      let mediaUrl: string | undefined;
      if (mediaUri) {
        const upload = await uploadFeedMediaToStorage(
          mediaUri,
          `${activeArtist.id}-feed`,
        );
        if (!upload.success || !upload.url) {
          throw new Error(upload.error || "Não foi possível enviar a mídia.");
        }
        mediaUrl = upload.url;
      }

      const result = await createSocialPost({
        artistId: activeArtist.id,
        text: text.trim(),
        location: location.trim() || null,
        media: mediaUrl
          ? [
              {
                media_type: mediaType,
                media_url: mediaUrl,
                thumbnail_url: mediaType === "video" ? mediaUrl : null,
              },
            ]
          : [],
        tags: [],
      });
      if (!result.success)
        throw new Error(result.error || "Não foi possível publicar.");
      router.back();
    } catch (publishError) {
      const message =
        publishError instanceof Error
          ? publishError.message
          : "Não foi possível publicar.";
      setError(message);
      Alert.alert("Erro ao publicar", message);
    } finally {
      setPublishing(false);
    }
  }, [activeArtist, location, mediaType, mediaUri, router, text]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          Nova postagem
        </Text>
        <TouchableOpacity
          disabled={publishing || !activeArtist}
          style={[
            styles.publishTopButton,
            { backgroundColor: activeArtist ? colors.primary : colors.border },
          ]}
          onPress={publish}
        >
          {publishing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.publishText}>Publicar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={contentScrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.artistRow}>
          <Image
            source={{
              uri:
                activeArtist?.profile_url ||
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
            }}
            style={styles.avatar}
          />
          <Text style={[styles.artistName, { color: colors.text }]}>
            {activeArtist?.name || "Selecione um artista"}
          </Text>
        </View>

        {mediaUri ? (
          <View
            style={[
              styles.preview,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <PostMediaPreview key={mediaUri} uri={mediaUri} type={mediaType} />
            <TouchableOpacity style={styles.change} onPress={pickMedia}>
              <Ionicons name="images-outline" size={17} color="#fff" />
              <Text style={styles.changeText}>Trocar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.picker,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={pickMedia}
          >
            <Ionicons name="images-outline" size={30} color={colors.primary} />
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              Adicionar foto ou vídeo
            </Text>
            <Text
              style={[styles.pickerSubtitle, { color: colors.textSecondary }]}
            >
              Mostre seu trabalho no feed
            </Text>
          </TouchableOpacity>
        )}

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Compartilhe uma novidade, show ou clipe..."
          placeholderTextColor={colors.textSecondary}
          multiline
          onFocus={keepInputVisible}
          textAlignVertical="top"
          style={[
            styles.input,
            styles.textarea,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
        />
        <TextInput
          value={location}
          onChangeText={setLocation}
          onFocus={keepInputVisible}
          placeholder="Localização (opcional)"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={{ height: Math.max(insets.bottom, 10) }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  publishTopButton: {
    minWidth: 88,
    minHeight: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  title: { fontSize: 20, fontWeight: "800" },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 280 },
  artistRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10 },
  artistName: { fontSize: 16, fontWeight: "700" },
  preview: {
    height: 280,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    marginBottom: 16,
  },
  previewImage: { width: "100%", height: "100%", backgroundColor: "#eef0f4" },
  videoPreview: { width: "100%", height: "100%" },
  play: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -24,
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  change: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,.6)",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  changeText: { color: "#fff", fontWeight: "700" },
  picker: {
    minHeight: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  pickerTitle: { marginTop: 10, fontSize: 16, fontWeight: "800" },
  pickerSubtitle: { marginTop: 5, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  textarea: { minHeight: 130 },
  error: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
  },
  publishText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
