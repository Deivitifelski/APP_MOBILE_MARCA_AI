import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeedVideoPlayer from '../../components/feed/social/FeedVideoPlayer';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useActiveArtistContext } from '../../contexts/ActiveArtistContext';
import { useTheme } from '../../contexts/ThemeContext';
import { uploadFeedMediaFile } from '../../services/supabase/feedMediaUploadService';
import { publicarSocialPost } from '../../services/supabase/socialFeedService';

type MidiaEscolhida = {
  uri: string;
  tipo: 'foto' | 'video';
  mimeType?: string | null;
  fileName?: string | null;
};

export default function PublicarMidiaFeedScreen() {
  const { colors } = useTheme();
  const { activeArtist } = useActiveArtistContext();
  const { canCreateEvents } = usePermissions();
  const [midia, setMidia] = useState<MidiaEscolhida | null>(null);
  const [legenda, setLegenda] = useState('');
  const [saving, setSaving] = useState(false);
  const pickerOpened = useRef(false);

  const escolherMidia = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão', 'Autorize o acesso à galeria para publicar foto ou vídeo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.85,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    setMidia({
      uri: asset.uri,
      tipo: isVideo ? 'video' : 'foto',
      mimeType: asset.mimeType ?? null,
      fileName: asset.fileName ?? null,
    });
  }, []);

  useEffect(() => {
    if (!pickerOpened.current) {
      pickerOpened.current = true;
      void escolherMidia();
    }
  }, [escolherMidia]);

  const submit = async () => {
    if (!activeArtist?.id) {
      Alert.alert('Artista', 'Selecione um artista nas Configurações.');
      return;
    }
    if (!canCreateEvents) {
      Alert.alert('Sem permissão', 'Somente admin ou vendedor pode publicar no feed.');
      return;
    }
    if (!midia) {
      Alert.alert('Mídia', 'Escolha uma foto ou um vídeo para publicar.');
      return;
    }

    setSaving(true);
    try {
      const uploaded = await uploadFeedMediaFile(midia.uri, activeArtist.id, midia.tipo, {
        mimeType: midia.mimeType,
        fileName: midia.fileName,
      });
      if (!uploaded.success || !uploaded.url) {
        Alert.alert('Upload', uploaded.error || 'Não foi possível enviar a mídia.');
        return;
      }

      const published = await publicarSocialPost({
        artistaId: activeArtist.id,
        body: legenda,
        mediaUrl: uploaded.url,
        mediaType: midia.tipo === 'video' ? 'video' : 'image',
      });
      if (!published.success) {
        Alert.alert('Publicar', published.error || 'Não foi possível publicar no feed.');
        return;
      }

      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Nova publicação</Text>
        <TouchableOpacity
          onPress={() => void submit()}
          disabled={saving || !midia}
          hitSlop={12}
          style={styles.publishBtn}
        >
          {saving ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text
              style={[
                styles.publishBtnText,
                { color: midia ? colors.primary : colors.textSecondary },
              ]}
            >
              Publicar
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={[
              styles.preview,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => void escolherMidia()}
            activeOpacity={0.85}
          >
            {midia ? (
              midia.tipo === 'foto' ? (
                <Image source={{ uri: midia.uri }} style={styles.previewImage} contentFit="cover" />
              ) : (
                <FeedVideoPlayer uri={midia.uri} isActive />
              )
            ) : (
              <View style={styles.previewEmpty}>
                <Ionicons name="images-outline" size={42} color={colors.primary} />
                <Text style={[styles.previewTitle, { color: colors.text }]}>Toque para escolher</Text>
                <Text style={[styles.previewSub, { color: colors.textSecondary }]}>
                  Foto ou vídeo da galeria
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.text }]}>Legenda</Text>
          <TextInput
            value={legenda}
            onChangeText={setLegenda}
            placeholder="Escreva uma legenda..."
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[
              styles.input,
              styles.multiline,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  publishBtn: {
    minWidth: 72,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  publishBtnText: { fontSize: 16, fontWeight: '800' },
  body: { padding: 16, paddingBottom: 40 },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { width: '100%', aspectRatio: 1 },
  previewEmpty: { alignItems: 'center', gap: 8, paddingVertical: 56 },
  previewTitle: { fontSize: 16, fontWeight: '800' },
  previewSub: { fontSize: 13 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
});
