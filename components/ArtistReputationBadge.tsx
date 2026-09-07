import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type ArtistReputationData = {
  mediaNota: number | null;
  totalAvaliacoes: number;
  showsRealizados: number;
};

type Props = {
  reputation: ArtistReputationData;
  onPressReviews?: () => void;
  compact?: boolean;
};

export default function ArtistReputationBadge({
  reputation,
  onPressReviews,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const { mediaNota, totalAvaliacoes, showsRealizados } = reputation;
  const hasRating = mediaNota != null && totalAvaliacoes > 0;

  if (!hasRating && showsRealizados === 0) {
    return (
      <Text style={[styles.empty, { color: colors.textSecondary }]}>
        Sem avaliações ainda
      </Text>
    );
  }

  const content = (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {hasRating ? (
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons
              key={n}
              name={n <= Math.round(mediaNota!) ? 'star' : 'star-outline'}
              size={compact ? 12 : 14}
              color="#F59E0B"
            />
          ))}
          <Text style={[styles.ratingText, { color: colors.text }]}>
            {mediaNota!.toFixed(1)} ({totalAvaliacoes})
          </Text>
        </View>
      ) : null}
      {showsRealizados > 0 ? (
        <Text style={[styles.showsText, { color: colors.textSecondary }]}>
          {hasRating ? ' · ' : ''}
          {showsRealizados} {showsRealizados === 1 ? 'show realizado' : 'shows realizados'}
        </Text>
      ) : null}
      {onPressReviews && hasRating ? (
        <Text style={[styles.link, { color: colors.primary }]}>Ver avaliações</Text>
      ) : null}
    </View>
  );

  if (onPressReviews && hasRating) {
    return (
      <TouchableOpacity onPress={onPressReviews} activeOpacity={0.75}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  rowCompact: {
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  showsText: {
    fontSize: 12,
  },
  link: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  empty: {
    fontSize: 12,
  },
});
