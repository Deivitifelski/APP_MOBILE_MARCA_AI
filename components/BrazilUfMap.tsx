import brazilMap from '@svg-maps/brazil';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const VIEWBOX_W = 613;
const VIEWBOX_H = 639;

type BrazilLocation = (typeof brazilMap.locations)[number];

function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export type BrazilUfMapProps = {
  /** Siglas em maiúsculas (ex.: RS, SP). */
  activeUfs: string[];
  fillActive: string;
  fillInactive: string;
  strokeColor: string;
};

/** Mapa SVG via WebView (evita RNSVGSvgView, que exige módulo nativo do react-native-svg). */
export function BrazilUfMap({
  activeUfs,
  fillActive,
  fillInactive,
  strokeColor,
}: BrazilUfMapProps) {
  const html = useMemo(() => {
    const activeLower = new Set<string>();
    for (const u of activeUfs) {
      const t = String(u).trim().toLowerCase();
      if (t.length >= 2) activeLower.add(t.slice(0, 2));
    }

    const pathsHtml = brazilMap.locations.map((loc: BrazilLocation) => {
      const id = String(loc.id).toLowerCase();
      const fill = activeLower.has(id) ? fillActive : fillInactive;
      const d = escapeXmlAttr(loc.path);
      return `<path d="${d}" fill="${fill}" stroke="${escapeXmlAttr(strokeColor)}" stroke-width="0.65"/>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<style>
html,body{margin:0;padding:0;background:transparent;}
svg{display:block;width:100%;height:auto;max-width:100%;}
</style>
</head>
<body>
<svg viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" xmlns="http://www.w3.org/2000/svg">${pathsHtml}</svg>
</body>
</html>`;
  }, [activeUfs, fillActive, fillInactive, strokeColor]);

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: VIEWBOX_W / VIEWBOX_H,
        backgroundColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        androidLayerType="hardware"
        opaque={false}
        pointerEvents="none"
        setBuiltInZoomControls={false}
        automaticallyAdjustContentInsets={false}
      />
    </View>
  );
}
