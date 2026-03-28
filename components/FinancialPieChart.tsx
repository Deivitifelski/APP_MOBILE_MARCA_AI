import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export type PieSlice = {
  value: number;
  color: string;
  label: string;
};

type Props = {
  slices: PieSlice[];
  size?: number;
  emptyLabel?: string;
  /** compact = só barra horizontal; detailed = colunas + barra (tela de detalhes) */
  variant?: 'compact' | 'detailed';
  /** Ex.: "R$ 58.349,13" — aparece abaixo do gráfico em detailed */
  totalLabel?: string;
};

export default function FinancialPieChart({
  slices,
  size = 200,
  emptyLabel = 'Sem dados para exibir',
  variant = 'compact',
  totalLabel,
}: Props) {
  const { colors } = useTheme();
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const positive = slices.filter((x) => x.value > 0);

  if (total <= 0 || positive.length === 0) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: size * 0.35 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{emptyLabel}</Text>
      </View>
    );
  }

  const barHeight =
    variant === 'detailed'
      ? Math.max(30, Math.round(size * 0.16))
      : Math.max(36, Math.round(size * 0.18));
  const maxColH = Math.min(112, Math.max(72, Math.round(size * 0.48)));

  const horizontalBar = (
    <View
      style={[
        styles.barOuter,
        {
          height: barHeight,
          borderRadius: barHeight / 2,
          backgroundColor: colors.background,
        },
      ]}
    >
      {positive.map((slice, i) => (
        <View
          key={`h-${i}`}
          style={{
            flex: Math.max(slice.value, 1e-9),
            backgroundColor: slice.color,
          }}
        />
      ))}
    </View>
  );

  if (variant === 'compact') {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>
          Distribuição proporcional da receita
        </Text>
        {horizontalBar}
      </View>
    );
  }

  /* detailed: colunas + barra + total (mais estreito, sem borda na barra) */
  return (
    <View style={[styles.wrap, styles.wrapNarrow]}>
      <View style={[styles.columnsWrap, { height: maxColH + 4 }]}>
        {positive.map((slice, i) => {
          const h = Math.max(10, (slice.value / total) * maxColH);
          return (
            <View key={`c-${i}`} style={styles.columnCell}>
              <View
                style={[
                  styles.columnBar,
                  {
                    height: h,
                    backgroundColor: slice.color,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {horizontalBar}

      {totalLabel ? (
        <Text style={[styles.totalLine, { color: colors.text }]}>Receita total · {totalLabel}</Text>
      ) : null}
    </View>
  );
}


const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'stretch',
    paddingVertical: 2,
    gap: 12,
  },
  wrapNarrow: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 10,
  },
  caption: {
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  barOuter: {
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 0,
  },
  columnsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 2,
  },
  columnCell: {
    flex: 1,
    maxWidth: 36,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  columnBar: {
    width: '100%',
    maxWidth: 32,
    borderRadius: 6,
    minHeight: 6,
  },
  totalLine: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
});
