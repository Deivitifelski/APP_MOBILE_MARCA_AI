import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { uploadArtistPressKitFile } from '../services/supabase/artistPressKitUploadService';
import { getCurrentUser } from '../services/supabase/authService';
import { getUserPermissions } from '../services/supabase/permissionsService';
import { userSubscriptionIsActive } from '../services/supabase/userService';

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

type PendingFile = { uri: string; name: string | null; mimeType: string | null };

export default function PressKitArtistaScreen() {
  const { colors } = useTheme();
  const { activeArtist } = useActiveArtistContext();
  const [items, setItems] = useState<ArtistPressKitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManageByRole, setCanManageByRole] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [fileTitleDraft, setFileTitleDraft] = useState('');
  const [showSharePickerModal, setShowSharePickerModal] = useState(false);
  const [selectedShareIds, setSelectedShareIds] = useState<string[]>([]);
  const [isPremiumSubscriber, setIsPremiumSubscriber] = useState(false);
  const [sharingItemId, setSharingItemId] = useState<string | null>(null);
  const canAddMaterials = canManageByRole && isPremiumSubscriber;

  const load = useCallback(async () => {
    if (!activeArtist?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { user } = await getCurrentUser();
      if (user) {
        const perms = await getUserPermissions(user.id, activeArtist.id);
        setCanManageByRole(perms?.role === 'admin' || perms?.role === 'editor');
        const { active } = await userSubscriptionIsActive(user.id);
        setIsPremiumSubscriber(active);
      } else {
        setCanManageByRole(false);
        setIsPremiumSubscriber(false);
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
            'A tabela de press kit ainda não foi criada no Supabase. Execute o script database/ARTIST_PRESS_KIT.sql no projeto.'
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
    if (!activeArtist?.id || !canAddMaterials) return;
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
    if (!activeArtist?.id || !canAddMaterials) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
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
    if (!activeArtist?.id || !pendingFile) return;
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
    if (!activeArtist?.id || items.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um link ou arquivo.');
      return;
    }
    const artistLabel = (activeArtist.name || '').trim() || 'Artista';
    await sharePressKitItems(artistLabel, items);
  };

  const toggleShareSelection = (id: string) => {
    setSelectedShareIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const onSharePress = () => {
    if (!activeArtist?.id || items.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um link ou arquivo.');
      return;
    }
    if (!isPremiumSubscriber) {
      Alert.alert(
        'Recurso para assinantes',
        'Nesta tela você pode:\n• Compartilhar todos os materiais\n• Selecionar itens para compartilhar\n• Compartilhar um item direto no card\n\nAssine o Premium para liberar o compartilhamento.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Ver planos', onPress: () => router.push('/assine-premium') },
        ]
      );
      return;
    }
    Alert.alert('Compartilhar press kit', 'Escolha como deseja compartilhar.', [
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
    if (!activeArtist?.id) return;
    const pickedItems = items.filter((it) => selectedShareIds.includes(it.id));
    if (pickedItems.length === 0) {
      Alert.alert('Atenção', 'Selecione ao menos um item para compartilhar.');
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
      canManage={canManageByRole}
      shareLoading={sharingItemId === item.id}
      onPressShare={() => {
        if (!isPremiumSubscriber) {
          Alert.alert(
            'Recurso para assinantes',
            'Nesta tela você pode:\n• Compartilhar todos os materiais\n• Selecionar itens para compartilhar\n• Compartilhar um item direto no card\n\nAssine o Premium para liberar o compartilhamento.',
            [
              { text: 'Agora não', style: 'cancel' },
              { text: 'Ver planos', onPress: () => router.push('/assine-premium') },
            ]
          );
          return;
        }
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
          <Text style={{ color: colors.textSecondary }}>Selecione um artista nas configurações.</Text>
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
            {items.length > 0 ? (
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
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            Logos, capas, textos e links para enviar rápido a produtores. Toda a equipe visualiza e baixa os materiais.
          </Text>
          <Text style={[styles.heroLimit, { color: colors.textSecondary }]}>
            Limite por artista: até 10 links, 10 arquivos e 20 textos.
          </Text>
        </View>
      </View>

      {canManageByRole ? (
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={[styles.toolbarBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (!isPremiumSubscriber) {
                Alert.alert(
                  'Recurso para assinantes',
                  'Adicionar materiais ao press kit está disponível para assinantes Premium.',
                  [
                    { text: 'Agora não', style: 'cancel' },
                    { text: 'Ver planos', onPress: () => router.push('/assine-premium') },
                  ]
                );
                return;
              }
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
              if (!isPremiumSubscriber) {
                Alert.alert(
                  'Recurso para assinantes',
                  'Adicionar materiais ao press kit está disponível para assinantes Premium.',
                  [
                    { text: 'Agora não', style: 'cancel' },
                    { text: 'Ver planos', onPress: () => router.push('/assine-premium') },
                  ]
                );
                return;
              }
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
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 32 }}>
              Nenhum material cadastrado. {canManageByRole ? 'Adicione links (Drive, site) ou envie arquivos.' : ''}
            </Text>
          }
        />
      )}

      <Modal visible={showLinkModal} transparent animationType="slide" onRequestClose={() => setShowLinkModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLinkModal(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Adicionar link</Text>
              <Text style={[styles.sheetHint, { color: colors.textSecondary }]}>
                Ex.: link do Drive, site oficial, EPK.
              </Text>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Título</Text>
              <TextInput
                value={linkTitle}
                onChangeText={setLinkTitle}
                placeholder="Logo horizontal"
                placeholderTextColor={colors.textSecondary}
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={pendingFile != null}
        transparent
        animationType="slide"
        onRequestClose={() => !uploadingFile && setPendingFile(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Nome do material</Text>
            <Text style={[styles.sheetHint, { color: colors.textSecondary }]}>
              Arquivo: {pendingFile?.name ?? '—'}
            </Text>
            <TextInput
              value={fileTitleDraft}
              onChangeText={setFileTitleDraft}
              placeholder="Como aparece na lista"
              placeholderTextColor={colors.textSecondary}
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
        </View>
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
            <Text style={[styles.sheetHint, { color: colors.textSecondary }]}>
              Marque os materiais que deseja compartilhar agora.
            </Text>

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
                        {it.item_type === 'link' ? 'Link' : it.item_type === 'file' ? 'Arquivo' : 'Texto'}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
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
