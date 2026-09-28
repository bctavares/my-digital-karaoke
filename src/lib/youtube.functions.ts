import { createServerFn } from "@tanstack/react-start";

type VideoInfo = { title: string; author: string; thumbnail: string };

export const lookupYoutubeVideo = createServerFn({ method: "POST" })
  .inputValidator((data: { youtubeId: string }) => {
    if (!/^[\w-]{11}$/.test(data.youtubeId)) throw new Error("ID de vídeo inválido");
    return data;
  })
  .handler(async ({ data }): Promise<VideoInfo> => {
    const fallback: VideoInfo = {
      title: `Vídeo ${data.youtubeId}`,
      author: "YouTube",
      thumbnail: `https://i.ytimg.com/vi/${data.youtubeId}/hqdefault.jpg`,
    };

    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${data.youtubeId}&format=json`,
      );
      if (!res.ok) return fallback;
      const json = (await res.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      return {
        title: json.title ?? fallback.title,
        author: json.author_name ?? fallback.author,
        thumbnail: json.thumbnail_url ?? fallback.thumbnail,
      };
    } catch {
      return fallback;
    }
  });
