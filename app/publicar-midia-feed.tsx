import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useState } from 'react';
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
import { usePermissions } from '../contexts/PermissionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useActiveArtist } from '../services/useActiveArtist';

type MidiaEscolhida = {
  uri: string;
  tipo: 'foto' | 'video';
};

export default function PublicarMidiaFeedScreen() {
  const { colors } = useTheme();
  const { activeArtist } = useActiveArtist();
  const { canCreateEvents } = usePermissions();
  const [midia, setMidia] = useState<MidiaEscolhida | null>(null);
  const [legenda, setLegenda] = useState('');
  const [saving, setSaving] = useState(false);

  const escolherMidia = async (somenteVideo: boolean) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão', 'Autorize o acesso à galeria para publicar foto ou vídeo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: somenteVideo
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: !somenteVideo,
      quality: 0.85,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video' || somenteVideo;
    setMidia({ uri: asset.uri, tipo: isVideo ? 'video' : 'foto' });
  };

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
      Alert.alert(
        'Pronto para publicar',
        midia.tipo === 'video'
          ? 'Seu vídeo foi selecionado. A publicação no feed será concluída na próxima etapa do banco.'
          : 'Sua foto foi selecionada. A publicação no feed será concluída na próxima etapa do banco.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Foto ou vídeo</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            Publique uma foto ou um vídeo normal no feed.
          </Text>

          <TouchableOpacity
            style={[
              styles.preview,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => void escolherMidia(false)}
            activeOpacity={0.85}
          >
            {midia ? (
              midia.tipo === 'foto' ? (
                <Image source={{ uri: midia.uri }} style={styles.previewImage} contentFit="cover" />
              ) : (
                <View style={styles.videoPreview}>
                  <Ionicons name="play-circle" size={56} color={colors.primary} />
                  <Text style={[styles.videoLabel, { color: colors.text }]}>Vídeo selecionado</Text>
                </View>
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

          <View style={styles.pickRow}>
            <TouchableOpacity
              style={[styles.pickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => void escolherMidia(false)}
            >
              <Ionicons name="image-outline" size={18} color={colors.primary} />
              <Text style={[styles.pickBtnText, { color: colors.text }]}>Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => void escolherMidia(true)}
            >
              <Ionicons name="videocam-outline" size={18} color={colors.primary} />
              <Text style={[styles.pickBtnText, { color: colors.text }]}>Vídeo</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Legenda (opcional)</Text>
          <TextInput
            value={legenda}
            onChangeText={setLegenda}
            placeholder="Escreva algo sobre esta publicação"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[
              styles.input,
              styles.multiline,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={() => void submit()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Publicar</Text>
            )}
          </TouchableOpacity>
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
  body: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: { width: '100%', height: 280 },
  previewEmpty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  previewTitle: { fontSize: 16, fontWeight: '800' },
  previewSub: { fontSize: 13 },
  videoPreview: { alignItems: 'center', gap: 10, paddingVertical: 72 },
  videoLabel: { fontSize: 15, fontWeight: '700' },
  pickRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  pickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
  },
  pickBtnText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  submit: {
    marginTop: 22,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
