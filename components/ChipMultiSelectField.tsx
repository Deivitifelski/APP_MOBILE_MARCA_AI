import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export interface ChipMultiSelectFieldProps {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onAddCustom: () => void;
  addSectionLabel: string;
  addPlaceholder: string;
}

export function ChipMultiSelectField({
  title,
  options,
  selected,
  onToggle,
  draft,
  onDraftChange,
  onAddCustom,
  addSectionLabel,
  addPlaceholder,
}: ChipMultiSelectFieldProps) {
  const { colors } = useTheme();

  const subtitle =
    selected.length === 0
      ? 'Toque nos chips para selecionar — pode marcar várias opções'
      : `${selected.length} selecionado${selected.length !== 1 ? 's' : ''}`;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

      <View
        style={[
          styles.card,
          {
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.chipWrap}>
          {options.map((opt) => {
            const on = selected.includes(opt);
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.chip,
                  {
                    borderColor: on ? colors.primary : colors.border,
                    backgroundColor: on ? colors.primary : colors.surface,
                  },
                ]}
                onPress={() => onToggle(opt)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, { color: on ? '#fff' : colors.text }]} numberOfLines={2}>
                  {opt}
                </Text>
                {on ? (
                  <Ionicons name="checkmark-circle" size={18} color="#fff" style={styles.chipCheck} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.addBlock, { borderTopColor: colors.border }]}>
          <Text style={[styles.addLabel, { color: colors.text }]}>{addSectionLabel}</Text>
          <View style={styles.addRow}>
            <TextInput
              style={[
                styles.addInput,
                { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
              ]}
              value={draft}
              onChangeText={onDraftChange}
              placeholder={addPlaceholder}
              placeholderTextColor={colors.textSecondary}
              onSubmitEditing={onAddCustom}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={onAddCustom}
            >
              <Text style={styles.addButtonText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    overflow: 'hidden',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
    width: '49%',
    minHeight: 42,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    flex: 1,
  },
  chipCheck: {
    marginLeft: 6,
  },
  addBlock: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  addLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    marginRight: 10,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
