import { supabase } from "../../lib/supabase";

export type FeedMediaItem = {
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url?: string | null;
};

export type FeedPost = {
  id: string;
  artistId: string;
  artistName: string;
  avatar: string;
  time: string;
  text: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  tags: string[];
  likes: number;
  comments: number;
  shares: number;
  location?: string;
};

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `há ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} d`;
}

function normalizeMediaArray(
  media: Array<{
    media_type?: string | null;
    media_url?: string | null;
    thumbnail_url?: string | null;
  }> = [],
): FeedMediaItem[] {
  return media
    .filter((item) => Boolean(item?.media_url))
    .map((item) => ({
      media_type: (item.media_type === "video" ? "video" : "image") as
        | "image"
        | "video",
      media_url: String(item.media_url),
      thumbnail_url: item.thumbnail_url ?? null,
    }));
}

export async function fetchSocialFeed(
  limit = 20,
  offset = 0,
): Promise<{ posts: FeedPost[]; error: string | null }> {
  try {
    const { data: postsData, error: postsError } = await supabase
      .from("social_posts")
      .select(
        `
        id,
        artist_id,
        body,
        location,
        created_at,
        artists!artist_id (
          id,
          name,
          profile_url,
          city,
          state,
          musical_style
        )
      `,
      )
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (postsError) {
      console.error("Erro ao buscar feed social:", postsError);
      return { posts: [], error: postsError.message };
    }

    if (!postsData || postsData.length === 0) {
      return { posts: [], error: null };
    }

    const postIds = postsData.map((post) => post.id);

    const [mediaResult, tagResult, likesResult, commentsResult] =
      await Promise.all([
        supabase
          .from("social_post_media")
          .select("post_id, media_type, media_url, thumbnail_url")
          .in("post_id", postIds),
        supabase
          .from("social_post_tags")
          .select("post_id, tag")
          .in("post_id", postIds),
        supabase
          .from("social_post_likes")
          .select("post_id")
          .in("post_id", postIds),
        supabase
          .from("social_post_comments")
          .select("post_id")
          .in("post_id", postIds),
      ]);

    const mediaByPost = new Map<string, FeedMediaItem[]>();
    (mediaResult.data ?? []).forEach((item) => {
      const key = String(item.post_id);
      const current = mediaByPost.get(key) ?? [];
      current.push({
        media_type: item.media_type === "video" ? "video" : "image",
        media_url: item.media_url,
        thumbnail_url: item.thumbnail_url ?? null,
      });
      mediaByPost.set(key, current);
    });

    const tagsByPost = new Map<string, string[]>();
    (tagResult.data ?? []).forEach((item) => {
      const key = String(item.post_id);
      const current = tagsByPost.get(key) ?? [];
      current.push(String(item.tag || "").trim());
      tagsByPost.set(key, current.filter(Boolean));
    });

    const likesByPost = new Map<string, number>();
    (likesResult.data ?? []).forEach((item) => {
      const key = String(item.post_id);
      likesByPost.set(key, (likesByPost.get(key) ?? 0) + 1);
    });

    const commentsByPost = new Map<string, number>();
    (commentsResult.data ?? []).forEach((item) => {
      const key = String(item.post_id);
      commentsByPost.set(key, (commentsByPost.get(key) ?? 0) + 1);
    });

    const posts: FeedPost[] = (
      postsData as Array<{
        id: string;
        artist_id: string;
        body: string;
        location: string | null;
        created_at: string;
        artists?: Array<{
          id: string;
          name: string;
          profile_url?: string | null;
          city?: string | null;
          state?: string | null;
          musical_style?: string | null;
        }> | null;
      }>
    ).map((post) => {
      // Extrair artista - pode vir como array ou objeto
      let artist = null;
      if (post.artists) {
        if (Array.isArray(post.artists)) {
          artist = post.artists[0] ?? null;
        } else if (typeof post.artists === "object") {
          artist = post.artists as any;
        }
      }

      const media = mediaByPost.get(post.id) ?? normalizeMediaArray([]);
      const firstMedia = media[0] ?? null;

      const artistName = artist?.name || "Artista Desconhecido";
      const avatar =
        artist?.profile_url ||
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80";

      return {
        id: post.id,
        artistId: post.artist_id,
        artistName,
        avatar,
        time: formatRelativeTime(post.created_at),
        text: post.body?.trim() || "",
        mediaType: firstMedia?.media_type ?? ("image" as const),
        mediaUrl: firstMedia?.media_url ?? "",
        tags: tagsByPost.get(post.id) ?? [],
        likes: likesByPost.get(post.id) ?? 0,
        comments: commentsByPost.get(post.id) ?? 0,
        shares: 0,
        location:
          post.location || artist?.city
            ? `${artist?.city || ""}${artist?.city && artist?.state ? ", " : ""}${artist?.state || ""}`.trim() ||
              undefined
            : undefined,
      };
    });

    return { posts, error: null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao carregar o feed";
    console.error("Erro inesperado ao buscar feed social:", error);
    return { posts: [], error: message };
  }
}

export async function fetchLikedPostIds(
  artistId: string,
  postIds: string[],
): Promise<{ postIds: string[]; error: string | null }> {
  if (!artistId || postIds.length === 0) {
    return { postIds: [], error: null };
  }

  const { data, error } = await supabase
    .from("social_post_likes")
    .select("post_id")
    .eq("artist_id", artistId)
    .in("post_id", postIds);

  return {
    postIds: (data ?? []).map((item) => String(item.post_id)),
    error: error?.message ?? null,
  };
}

export async function toggleSocialPostLike({
  postId,
  artistId,
  liked,
}: {
  postId: string;
  artistId: string;
  liked: boolean;
}): Promise<{ success: boolean; error: string | null }> {
  const result = liked
    ? await supabase
        .from("social_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("artist_id", artistId)
    : await supabase
        .from("social_post_likes")
        .insert({ post_id: postId, artist_id: artistId });

  return {
    success: !result.error,
    error: result.error?.message ?? null,
  };
}

export async function uploadFeedMediaToStorage(
  uri: string,
  fileName: string,
): Promise<{ success: boolean; error: string | null; url?: string }> {
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(
        `Não foi possível ler a mídia selecionada (${response.status}).`,
      );
    }

    const fileBuffer = await response.arrayBuffer();
    const extension = uri.split(".").pop()?.split("?")[0] || "jpg";
    const normalizedExtension = extension.toLowerCase();
    const contentType =
      normalizedExtension === "mp4"
        ? "video/mp4"
        : normalizedExtension === "mov"
          ? "video/quicktime"
          : normalizedExtension === "m4v"
            ? "video/x-m4v"
            : "image/jpeg";
    const uniqueFileName = `${fileName}-${Date.now()}.${extension}`;

    const { data, error } = await supabase.storage
      .from("feed")
      .upload(uniqueFileName, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from("feed")
      .getPublicUrl(data?.path || uniqueFileName);

    return {
      success: true,
      error: null,
      url: urlData.publicUrl,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Erro ao enviar mídia do feed",
    };
  }
}

export async function createSocialPost({
  artistId,
  text,
  location,
  media,
  tags,
}: {
  artistId: string;
  text: string;
  location?: string | null;
  media: Array<{
    media_type: "image" | "video";
    media_url: string;
    thumbnail_url?: string | null;
  }>;
  tags: string[];
}): Promise<{ success: boolean; error: string | null; postId?: string }> {
  try {
    const { data: postData, error: postError } = await supabase
      .from("social_posts")
      .insert({
        artist_id: artistId,
        body: text.trim() || " ",
        location: location || null,
        is_published: true,
      })
      .select("id")
      .single();

    if (postError || !postData) {
      return {
        success: false,
        error: postError?.message || "Erro ao criar post",
      };
    }

    const mediaRows = media.map((item, index) => ({
      post_id: postData.id,
      media_type: item.media_type,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url ?? null,
      sort_order: index,
    }));

    if (mediaRows.length > 0) {
      const { error: mediaError } = await supabase
        .from("social_post_media")
        .insert(mediaRows);
      if (mediaError) {
        return { success: false, error: mediaError.message };
      }
    }

    const tagRows = tags.filter(Boolean).map((tag) => ({
      post_id: postData.id,
      tag,
    }));

    if (tagRows.length > 0) {
      const { error: tagError } = await supabase
        .from("social_post_tags")
        .insert(tagRows);
      if (tagError) {
        return { success: false, error: tagError.message };
      }
    }

    return { success: true, error: null, postId: postData.id };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro ao criar conteúdo do feed",
    };
  }
}

export async function addSocialPostMedia({
  postId,
  media,
}: {
  postId: string;
  media: Array<{
    media_type: "image" | "video";
    media_url: string;
    thumbnail_url?: string | null;
  }>;
}): Promise<{ success: boolean; error: string | null }> {
  if (media.length === 0) return { success: true, error: null };

  const { error } = await supabase.from("social_post_media").insert(
    media.map((item, index) => ({
      post_id: postId,
      media_type: item.media_type,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url ?? null,
      sort_order: index,
    })),
  );

  return { success: !error, error: error?.message ?? null };
}
