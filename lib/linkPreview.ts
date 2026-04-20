/**
 * Prévia de links (YouTube, Vimeo, etc.) via noembed + fallback de miniatura do YouTube.
 */

export type LinkPreviewResult = {
  remoteTitle: string | null;
  thumbnailUrl: string | null;
};

export function extractYouTubeVideoId(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]?.split('?')[0];
      if (id && /^[\w-]{11}$/.test(id)) return id;
      return null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'www.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;

      const parts = u.pathname.split('/').filter(Boolean);
      const embedI = parts.indexOf('embed');
      if (embedI >= 0 && parts[embedI + 1]) {
        const id = parts[embedI + 1].split('?')[0];
        if (id && /^[\w-]{11}$/.test(id)) return id;
      }
      const shortsI = parts.indexOf('shorts');
      if (shortsI >= 0 && parts[shortsI + 1]) {
        const id = parts[shortsI + 1].split('?')[0];
        if (id && /^[\w-]{11}$/.test(id)) return id;
      }
      const liveI = parts.indexOf('live');
      if (liveI >= 0 && parts[liveI + 1]) {
        const id = parts[liveI + 1].split('?')[0];
        if (id && /^[\w-]{11}$/.test(id)) return id;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getDisplayHostname(url: string): string {
  try {
    const u = new URL(url.trim());
    return u.hostname.replace(/^www\./, '') || 'Link';
  } catch {
    return 'Link';
  }
}

/**
 * Busca título e miniatura (quando disponível) sem chave de API.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewResult> {
  const normalized = url.trim();
  if (!normalized) {
    return { remoteTitle: null, thumbnailUrl: null };
  }

  let fullUrl = normalized;
  if (!/^https?:\/\//i.test(fullUrl)) {
    fullUrl = `https://${fullUrl}`;
  }

  const ytId = extractYouTubeVideoId(fullUrl);
  const thumbFallback = ytId ? youtubeThumbnailUrl(ytId) : null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(fullUrl)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { remoteTitle: null, thumbnailUrl: thumbFallback };
    }

    const data = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
      error?: string;
    };

    if (data.error) {
      return { remoteTitle: null, thumbnailUrl: thumbFallback };
    }

    const thumb =
      typeof data.thumbnail_url === 'string' && data.thumbnail_url.length > 0
        ? data.thumbnail_url
        : thumbFallback;

    return {
      remoteTitle: typeof data.title === 'string' && data.title.length > 0 ? data.title : null,
      thumbnailUrl: thumb,
    };
  } catch {
    return { remoteTitle: null, thumbnailUrl: thumbFallback };
  }
}
