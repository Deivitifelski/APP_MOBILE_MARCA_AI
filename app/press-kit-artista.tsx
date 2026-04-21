import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PressKitListItem from '../components/PressKitListItem';
import { useActiveArtistContext } from '../contexts/ActiveArtistContext';
import { useTheme } from '../contexts/ThemeContext';
import { sharePressKitItems } from '../services/pressKitShareService';
import {
  addArtistPressKitFile,
  addArtistPressKitLink,
  deleteArtistPressKitItem,
  listArtistPressKitItems,
  type ArtistPressKitItem,
} from '../services/supabase/artistPressKitService';
import { PRESS_KIT_MAX_FILE_BYTES } from '../services/supabase/pressKitConstants';
import { uploadArtistPressKitFile } from '../services/supabase/artistPressKitUploadService';
import { getCurrentUser } from '../services/supabase/authService';
import { getUserPermissions } from '../services/supabase/permissionsService';
import { userSubscriptionIsActive } from '../services/supabase/userService';

function alertPressKitFileTooLarge() {
  Alert.alert(
    'Arquivo muito grande',
    'O arquivo ultrapassa o limite de 50 MB. Escolha um arquivo menor.'
  );
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

type PendingFile = { uri: string; name: string | null; mimeType: string | null };

export default function PressKitArtistaScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeArtist } = useActiveArtistContext();
  const [items, setItems] = useState<ArtistPressKitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isArtistAdmin, setIsArtistAdmin] = useState(false);
  const [isPremiumSubscriber, setIsPremiumSubscriber] = useState(false);

  const canInsertMaterials = isArtistAdmin || isPremiumSubscriber;
  const canSharePressKit = isArtistAdmin;
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [fileTitleDraft, setFileTitleDraft] = useState('');
  const [showSharePickerModal, setShowSharePickerModal] = useState(false);
  const [selectedShareIds, setSelectedShareIds] = useState<string[]>([]);
  const [sharingItemId, setSharingItemId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeArtist?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { user } = await getCurrentUser();
      if (!user) {
        setIsArtistAdmin(false);
        setIsPremiumSubscriber(false);
        return;
      }
      const perms = await getUserPermissions(user.id, activeArtist.id);
      const admin = perms?.role === 'admin';
      const { active: premium } = await userSubscriptionIsActive(user.id);
      setIsArtistAdmin(admin);
      setIsPremiumSubscriber(premium);
      if (!admin && !premium) {
        Alert.alert('Press kit', 'Só administrador ou assinante Premium.');
        router.back();
        return;
      }
      const { items: rows, error } = await listArtistPressKitItems(activeArtist.id);
      if (error) {
        setItems([]);
        if (
          error.includes('artist_press_kit_items') ||
          error.includes('schema cache') ||
          error.toLowerCase().includes('relation') ||
          error.includes('does not exist')
        ) {
          Alert.alert(
            'Configuração pendente',
            'Crie a tabela no Supabase (script database/ARTIST_PRESS_KIT.sql).'
          );
        }
      } else {
        setItems(rows);
      }
    } finally {
      setLoading(false);
    }
  }, [activeArtist?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onAddLink = async () => {
    if (!activeArtist?.id || !canInsertMaterials) return;
    const title = linkTitle.trim();
    const urlRaw = linkUrl.trim();
    if (!title || !urlRaw) {
      Alert.alert('Atenção', 'Preencha título e URL.');
      return;
    }
    const url = normalizeUrl(urlRaw);
    setSavingLink(true);
    try {
      const { error } = await addArtistPressKitLink(activeArtist.id, title, url);
      if (error) {
        Alert.alert('Erro', error);
        return;
      }
      setShowLinkModal(false);
      setLinkTitle('');
      setLinkUrl('');
      await load();
    } finally {
      setSavingLink(false);
    }
  };

  const onPickFile = async () => {
    if (!activeArtist?.id || !canInsertMaterials) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      if (typeof asset.size === 'number' && asset.size > PRESS_KIT_MAX_FILE_BYTES) {
        alertPressKitFileTooLarge();
        return;
      }
      if (asset.size == null) {
        try {
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (info.exists && typeof info.size === 'number' && info.size > PRESS_KIT_MAX_FILE_BYTES) {
            alertPressKitFileTooLarge();
            return;
          }
        } catch {
          // segue: o upload também valida tamanho quando possível
        }
      }
      const defaultTitle = asset.name?.replace(/\.[^/.]+$/, '') || 'Arquivo';
      setPendingFile({
        uri: asset.uri,
        name: asset.name ?? null,
        mimeType: asset.mimeType ?? null,
      });
      setFileTitleDraft(defaultTitle);
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo.');
    }
  };

  const confirmUploadPendingFile = async () => {
    if (!activeArtist?.id || !pendingFile || !canInsertMaterials) return;
    try {
      const info = await FileSystem.getInfoAsync(pendingFile.uri);
      if (info.exists && typeof info.size === 'number' && info.size > PRESS_KIT_MAX_FILE_BYTES) {
        alertPressKitFileTooLarge();
        setPendingFile(null);
        setFileTitleDraft('');
        return;
      }
    } catch {
      // continua; upload valida de novo
    }
    const title = fileTitleDraft.trim() || pendingFile.name || 'Arquivo';
    setUploadingFile(true);
    try {
      const upload = await uploadArtistPressKitFile(activeArtist.id, pendingFile.uri, {
        mimeType: pendingFile.mimeType,
        fileName: pendingFile.name,
      });
      if (!upload.success || !upload.url || !upload.storagePath) {
        Alert.alert('Erro', upload.error || 'Falha no upload.');
        return;
      }
      const { error } = await addArtistPressKitFile(activeArtist.id, title, upload.url, upload.storagePath);
      if (error) {
        Alert.alert('Erro', error);
        return;
      }
      setPendingFile(null);
      setFileTitleDraft('');
      await load();
    } finally {
      setUploadingFile(false);
    }
  };

  const shareList = async () => {
    if (!canSharePressKit) return;
    if (!activeArtist?.id || items.length === 0) {
      Alert.alert('Atenção', 'Adicione itens antes.');
      return;
    }
    const artistLabel = (activeArtist.name || '').trim() || 'Artista';
    await sharePressKitItems(artistLabel, items);
  };

  const toggleShareSelection = (id: string) => {
    setSelectedShareIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const onSharePress = () => {
    if (!canSharePressKit) return;
    if (!activeArtist?.id || items.length === 0) {
      Alert.alert('Atenção', 'Adicione itens antes.');
      return;
    }
    Alert.alert('Compartilhar', 'Enviar tudo ou escolher itens?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Enviar tudo',
        onPress: () => {
          void shareList();
        },
      },
      {
        text: 'Selecionar itens',
        onPress: () => {
          setSelectedShareIds(items.map((it) => it.id));
          setShowSharePickerModal(true);
        },
      },
    ]);
  };

  const shareSelectedItems = async () => {
    if (!canSharePressKit || !activeArtist?.id) return;
    const pickedItems = items.filter((it) => selectedShareIds.includes(it.id));
    if (pickedItems.length === 0) {
      Alert.alert('Atenção', 'Marque pelo menos um item.');
      return;
    }
    const artistLabel = (activeArtist.name || '').trim() || 'Artista';
    setShowSharePickerModal(false);
    await sharePressKitItems(artistLabel, pickedItems);
  };

  const renderItem = ({ item }: { item: ArtistPressKitItem }) => (
    <PressKitListItem
      item={item}
      colors={colors}
      canDelete={isArtistAdmin}
      canShare={canSharePressKit}
      shareLoading={sharingItemId === item.id}
      onPressShare={() => {
        const artistLabel = (activeArtist?.name || '').trim() || 'Artista';
        setSharingItemId(item.id);
        void sharePressKitItems(artistLabel, [item]).finally(() => {
          setSharingItemId((current) => (current === item.id ? null : current));
        });
      }}
      onPressDelete={() => {
        Alert.alert('Remover', `Remover "${item.title}"?`, [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Remover',
            style: 'destructive',
            onPress: async () => {
              const { error } = await deleteArtistPressKitItem(item);
              if (error) Alert.alert('Erro', error);
              else await load();
            },
          },
        ]);
      }}
    />
  );

  if (!activeArtist) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerSideSlot}>
              <TouchableOpacity onPress={() => router.back()} style={styles.headerIconButton}>
                <Ionicons name="arrow-back" size={26} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.headerScreenTitle, { color: colors.text }]} numberOfLines={1}>
              Press kit
            </Text>
            <View style={styles.headerSideSlotEnd}>
              <View style={styles.headerRightSpacer} />
            </View>
          </View>
        </View>
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>Escolha um artista em Configurações.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerSideSlot}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIconButton}>
              <Ionicons name="arrow-back" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.headerScreenTitle, { color: colors.text }]} numberOfLines={1}>
            Press kit
          </Text>
          <View style={[styles.headerButtons, styles.headerSideSlotEnd]}>
            {items.length > 0 && canSharePressKit ? (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={onSharePress}
                accessibilityLabel="Compartilhar lista"
              >
                <Ionicons name="share-outline" size={26} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerRightSpacer} />
            )}
          </View>
        </View>
      </View>

      <View style={[styles.hero, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' }]}>
        <Ionicons name="color-palette-outline" size={28} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>{activeArtist.name}</Text>
          {isArtistAdmin ? (
            <>
              <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
                Materiais do artista. Você compartilha; quem é Premium pode incluir links e arquivos.
              </Text>
              <Text style={[styles.heroLimit, { color: colors.textSecondary }]}>
                Até 10 links e 10 arquivos.
              </Text>
            </>
          ) : (
            <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
              Inclua links ou arquivos. Só o administrador compartilha.
            </Text>
          )}
        </View>
      </View>

      {canInsertMaterials ? (
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={[styles.toolbarBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setLinkTitle('');
              setLinkUrl('');
              setShowLinkModal(true);
            }}
            disabled={uploadingFile}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.toolbarBtnText}>Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toolbarBtn,
              { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
            ]}
            onPress={() => {
              void onPickFile();
            }}
            disabled={uploadingFile}
          >
            {uploadingFile ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.text} />
                <Text style={[styles.toolbarBtnTextDark, { color: colors.text }]}>Arquivo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 ? styles.listContentEmpty : null,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState} accessibilityLabel="Nenhum material no press kit">
              <Ionicons name="folder-open-outline" size={72} color={colors.textSecondary} style={{ opacity: 0.55 }} />
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                Nenhum material
              </Text>
              <Text style={[styles.emptyStateHint, { color: colors.textSecondary }]}>
                {canInsertMaterials ? 'Use Link ou Arquivo acima.' : 'Só o administrador adiciona itens.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={showLinkModal} transparent animationType="fade" onRequestClose={() => setShowLinkModal(false)}>
        <KeyboardAvoidingView
          style={styles.linkModalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : Math.max(insets.top, 16)}
        >
          <Pressable style={styles.linkModalBackdrop} onPress={() => setShowLinkModal(false)} />
          <View style={styles.linkModalCenterWrap} pointerEvents="box-none">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.linkModalScrollInner}
            >
              <View
                onStartShouldSetResponder={() => true}
                style={[styles.linkModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Adicionar link</Text>
                <Text style={[styles.sheetHint, { color: colors.textSecondary }]}>Endereço na web (URL).</Text>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Título</Text>
                <TextInput
                  value={linkTitle}
                  onChangeText={setLinkTitle}
                  placeholder="Logo horizontal"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="next"
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                />
                <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>URL</Text>
                <TextInput
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                  placeholder="https://..."
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="done"
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                />
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[styles.sheetGhost, { borderColor: colors.border }]}
                    onPress={() => setShowLinkModal(false)}
                  >
                    <Text style={{ color: colors.text }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetPrimary, { backgroundColor: colors.primary }]}
                    onPress={() => void onAddLink()}
                    disabled={savingLink}
                  >
                    {savingLink ? <ActivityIndicator color="#fff" /> : <Text style={styles.sheetPrimaryText}>Salvar</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={pendingFile != null}
        transparent
        animationType="fade"
        onRequestClose={() => !uploadingFile && setPendingFile(null)}
      >
        <KeyboardAvoidingView
          style={styles.linkModalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : Math.max(insets.top, 16)}
        >
          <Pressable
            style={styles.linkModalBackdrop}
            onPress={() => {
              if (!uploadingFile) {
                setPendingFile(null);
                setFileTitleDraft('');
              }
            }}
          />
          <View style={styles.linkModalCenterWrap} pointerEvents="box-none">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.linkModalScrollInner}
            >
              <View
                onStartShouldSetResponder={() => true}
                style={[styles.linkModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Nome do material</Text>
                <Text style={[styles.sheetHint, { color: colors.textSecondary }]}>
                  Arquivo: {pendingFile?.name ?? '—'}
                </Text>
                <TextInput
                  value={fileTitleDraft}
                  onChangeText={setFileTitleDraft}
                  placeholder="Como aparece na lista"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="done"
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                  editable={!uploadingFile}
                />
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[styles.sheetGhost, { borderColor: colors.border }]}
                    disabled={uploadingFile}
                    onPress={() => {
                      setPendingFile(null);
                      setFileTitleDraft('');
                    }}
                  >
                    <Text style={{ color: colors.text }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetPrimary, { backgroundColor: colors.primary }]}
                    disabled={uploadingFile}
                    onPress={() => void confirmUploadPendingFile()}
                  >
                    {uploadingFile ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.sheetPrimaryText}>Enviar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showSharePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSharePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Selecionar itens</Text>
            <Text style={[styles.sheetHint, { color: colors.textSecondary }]}>Marque o que enviar.</Text>

            <View style={styles.shareSelectActionsRow}>
              <TouchableOpacity
                style={[styles.sheetGhostSmall, { borderColor: colors.border }]}
                onPress={() => setSelectedShareIds(items.map((it) => it.id))}
              >
                <Text style={{ color: colors.text }}>Selecionar todos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetGhostSmall, { borderColor: colors.border }]}
                onPress={() => setSelectedShareIds([])}
              >
                <Text style={{ color: colors.text }}>Limpar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.shareItemsList}>
              {items.map((it) => {
                const checked = selectedShareIds.includes(it.id);
                return (
                  <TouchableOpacity
                    key={it.id}
                    style={[styles.sharePickerRow, { borderColor: colors.border }]}
                    onPress={() => toggleShareSelection(it.id)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sharePickerTitle, { color: colors.text }]} numberOfLines={1}>
                        {it.title}
                      </Text>
                      <Text style={[styles.sharePickerType, { color: colors.textSecondary }]}>
                        {it.item_type === 'link' ? 'Link' : 'Arquivo'}
                      </Text>
                    </View>
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={checked ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.sheetGhost, { borderColor: colors.border }]}
                onPress={() => setShowSharePickerModal(false)}
              >
                <Text style={{ color: colors.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetPrimary, styles.shareConfirmButton, { backgroundColor: colors.primary }]}
                onPress={() => void shareSelectedItems()}
              >
                <Text style={[styles.sheetPrimaryText, styles.shareConfirmButtonText]} numberOfLines={1}>
                  Compartilhar selecionados
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSideSlot: {
    minWidth: 42,
    alignItems: 'flex-start',
  },
  headerSideSlotEnd: {
    minWidth: 42,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    padding: 8,
  },
  headerRightSpacer: {
    width: 42,
    height: 42,
  },
  headerScreenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  hero: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroTitle: { fontSize: 17, fontWeight: '700' },
  heroSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  heroLimit: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  toolbarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  toolbarBtnText: { color: '#fff', fontWeight: '600' },
  toolbarBtnTextDark: { fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    minHeight: 280,
  },
  emptyStateTitle: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyStateHint: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  linkModalRoot: {
    flex: 1,
  },
  linkModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  linkModalCenterWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  linkModalScrollInner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  linkModalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetHint: { fontSize: 13, marginTop: 6, marginBottom: 12 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  textAreaInput: {
    minHeight: 110,
  },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  shareSelectActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  sheetGhostSmall: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  shareItemsList: {
    maxHeight: 280,
    gap: 8,
  },
  sharePickerRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sharePickerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sharePickerType: {
    fontSize: 12,
    marginTop: 3,
  },
  sheetGhost: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  sheetPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  sheetPrimaryText: { color: '#fff', fontWeight: '700' },
  shareConfirmButton: {
    paddingHorizontal: 8,
  },
  shareConfirmButtonText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
