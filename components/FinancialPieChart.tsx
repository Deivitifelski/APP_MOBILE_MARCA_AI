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
  /** Usado como cor da borda ao redor da barra proporcional */
  strokeColor?: string;
};

/**
 * Distribuição proporcional sem react-native-svg (evita RNSVGSvgView unimplemented
 * em alguns builds Expo / web). Mesma informação que um gráfico de pizza.
 */
export default function FinancialPieChart({
  slices,
  size = 200,
  emptyLabel = 'Sem dados para exibir',
  strokeColor = 'rgba(0,0,0,0.08)',
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

  const barHeight = Math.max(44, Math.round(size * 0.22));

  return (
    <View style={styles.wrap}>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        Distribuição proporcional da receita
      </Text>
      <View
        style={[
          styles.barOuter,
          {
            height: barHeight,
            borderRadius: barHeight / 2,
            borderColor: strokeColor,
          },
        ]}
      >
        {positive.map((slice, i) => (
          <View
            key={i}
            style={{
              flex: Math.max(slice.value, 1e-9),
              backgroundColor: slice.color,
              marginRight: i < positive.length - 1 ? StyleSheet.hairlineWidth * 2 : 0,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'stretch',
    paddingVertical: 4,
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
    borderWidth: StyleSheet.hairlineWidth,
  },
});
