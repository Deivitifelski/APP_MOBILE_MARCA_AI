import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../../contexts/ThemeContext';

type Props = {
  uri: string;
  isActive: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildVideoHtml(uri: string): string {
  const safeUri = escapeHtml(uri);
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #000;
        overflow: hidden;
      }
      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        background: #000;
      }
    </style>
  </head>
  <body>
    <video id="player" src="${safeUri}" playsinline webkit-playsinline loop muted autoplay></video>
  </body>
</html>`;
}

export default function FeedVideoPlayer({ uri, isActive }: Props) {
  const { colors } = useTheme();
  const webRef = useRef<WebView>(null);
  const mutedRef = useRef(true);
  const [muted, setMuted] = React.useState(true);

  const html = useMemo(() => buildVideoHtml(uri), [uri]);
  const isFileUri = uri.startsWith('file://');

  const syncPlayback = (nextMuted: boolean, playing: boolean) => {
    webRef.current?.injectJavaScript(`
      (function () {
        var video = document.getElementById('player');
        if (!video) return true;
        video.muted = ${nextMuted ? 'true' : 'false'};
        if (${playing ? 'true' : 'false'}) {
          video.play().catch(function () {});
        } else {
          video.pause();
        }
        return true;
      })();
    `);
  };

  useEffect(() => {
    mutedRef.current = muted;
    syncPlayback(muted, isActive);
  }, [muted, isActive]);

  return (
    <View style={styles.wrap}>
      <WebView
        ref={webRef}
        source={isFileUri ? { html, baseUrl: uri } : { html }}
        style={styles.video}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        onLoadEnd={() => syncPlayback(mutedRef.current, isActive)}
      />
      <TouchableOpacity
        style={[styles.muteBtn, { backgroundColor: `${colors.background}CC` }]}
        onPress={() => setMuted((prev) => !prev)}
        hitSlop={12}
        accessibilityLabel={muted ? 'Ativar som' : 'Silenciar'}
      >
        <Ionicons
          name={muted ? 'volume-mute' : 'volume-high'}
          size={18}
          color={colors.text}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  muteBtn: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
