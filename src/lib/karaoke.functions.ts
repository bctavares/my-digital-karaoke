import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PerformanceRating = {
  id: string;
  queue_item_id: string;
  rater_token: string;
  score: number;
  created_at: string;
};

export type Song = {
  id: string;
  youtube_id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
  play_count: number;
};

export type QueueItem = {
  id: string;
  room_id: string;
  song_id: string;
  singer_name: string;
  requester_token: string;
  status: string;
  position: number;
  song: Song | null;
};

export type PublicRoom = {
  id: string;
  code: string;
  name: string;
  is_playing: boolean;
  transition_seconds: number;
  countdown_until: string | null;
};

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z2-9]{4,8}$/, "Código de sala inválido");

const tokenSchema = z.string().min(8).max(128);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function runtimeSupabaseRef() {
  const url = process.env['SUPABASE_URL'];
  if (!url) return "SUPABASE_URL ausente";
  try {
    return new URL(url).hostname;
  } catch {
    return "SUPABASE_URL inválida";
  }
}

async function getRoomByCode(code: string) {
  const db = await admin();
  const { data, error } = await db
    .from("rooms")
    .select("id, code, name, host_token, is_playing, transition_seconds")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error("Erro ao buscar a sala");
  return data;
}

async function requireHost(code: string, hostToken: string) {
  const room = await getRoomByCode(code);
  if (!room) throw new Error("Sala não encontrada");
  if (room.host_token !== hostToken) throw new Error("Você não é o anfitrião desta sala");
  return room;
}

function toPublicRoom(room: {
  id: string;
  code: string;
  name: string;
  is_playing: boolean;
  transition_seconds: number;
  countdown_until?: string | null;
}): PublicRoom {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    is_playing: room.is_playing,
    transition_seconds: room.transition_seconds,
    countdown_until: room.countdown_until ?? null,
  };
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().trim().max(40).default(""),
        code: codeSchema,
        hostToken: tokenSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<PublicRoom> => {
    const db = await admin();
    const { data: room, error } = await db
      .from("rooms")
      .insert({
        code: data.code,
        name: data.name || "Karaokê",
        host_token: data.hostToken,
      })
      .select("id, code, name, is_playing, transition_seconds")
      .single();
    if (error) {
      if (error.message.includes("duplicate")) throw new Error("Código em uso, tente outro");
      throw new Error(
        `${error.message || "Não foi possível criar a sala"} [runtime-supabase=${runtimeSupabaseRef()}]`,
      );
    }
    return toPublicRoom(room);
  });

export const getRoom = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ code: codeSchema }).parse(data))
  .handler(async ({ data }): Promise<PublicRoom | null> => {
    const room = await getRoomByCode(data.code);
    return room ? toPublicRoom(room) : null;
  });

export const verifyHost = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: codeSchema, hostToken: tokenSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<boolean> => {
    const room = await getRoomByCode(data.code);
    return Boolean(room && room.host_token === data.hostToken);
  });

export const getQueue = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ code: codeSchema }).parse(data))
  .handler(async ({ data }): Promise<QueueItem[]> => {
    const room = await getRoomByCode(data.code);
    if (!room) return [];
    const db = await admin();
    const { data: items, error } = await db
      .from("queue_items")
      .select(
        "id, room_id, song_id, singer_name, requester_token, status, position, song:songs(id, youtube_id, title, author, thumbnail_url, play_count)",
      )
      .eq("room_id", room.id)
      .in("status", ["pending", "playing"])
      .order("position", { ascending: true });
    if (error) throw new Error("Erro ao carregar a fila");
    return (items ?? []) as unknown as QueueItem[];
  });

export const getPerformanceRatings = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ code: codeSchema, itemId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<PerformanceRating[]> => {
    const room = await getRoomByCode(data.code);
    if (!room) return [];
    const db = await admin();
    const { data: item } = await db
      .from("queue_items")
      .select("id")
      .eq("id", data.itemId)
      .eq("room_id", room.id)
      .maybeSingle();
    if (!item) throw new Error("Apresentação não encontrada");
    const { data: ratings, error } = await db
      .from("performance_ratings")
      .select("id, queue_item_id, rater_token, score, created_at")
      .eq("queue_item_id", data.itemId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Erro ao carregar as avaliações");
    return (ratings ?? []) as PerformanceRating[];
  });

export const ratePerformance = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      code: codeSchema,
      itemId: z.string().uuid(),
      raterToken: tokenSchema,
      score: z.number().int().min(1).max(5),
    }).parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await getRoomByCode(data.code);
    if (!room) throw new Error("Sala não encontrada");
    const db = await admin();
    const { data: item } = await db
      .from("queue_items")
      .select("id, room_id, status")
      .eq("id", data.itemId)
      .eq("room_id", room.id)
      .maybeSingle();
    if (!item) throw new Error("Apresentação não encontrada");
    if (!["playing", "done"].includes(item.status)) {
      throw new Error("Essa apresentação ainda não está disponível para avaliação");
    }
    const { error } = await db
      .from("performance_ratings")
      .upsert(
        {
          queue_item_id: data.itemId,
          rater_token: data.raterToken,
          score: data.score,
        },
        { onConflict: "queue_item_id,rater_token" },
      );
    if (error) throw new Error(error.message || "Não consegui salvar sua nota");
  });

export const searchLibrary = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ search: z.string().trim().max(80).default("") }).parse(data),
  )
  .handler(async ({ data }): Promise<Song[]> => {
    const db = await admin();
    let query = db
      .from("songs")
      .select("id, youtube_id, title, author, thumbnail_url, play_count")
      .order("play_count", { ascending: false })
      .limit(40);
    if (data.search) query = query.ilike("title", `%${data.search}%`);
    const { data: songs, error } = await query;
    if (error) throw new Error("Erro ao buscar músicas");
    return songs ?? [];
  });

export const addSong = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        youtubeId: z.string().regex(/^[\w-]{11}$/, "ID de vídeo inválido"),
        title: z.string().trim().min(1).max(200),
        author: z.string().trim().max(120).nullable().default(null),
        thumbnail: z.string().url().max(500).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<Song> => {
    const db = await admin();
    const { data: existing } = await db
      .from("songs")
      .select("id, youtube_id, title, author, thumbnail_url, play_count")
      .eq("youtube_id", data.youtubeId)
      .maybeSingle();
    if (existing) return existing;
    const { data: song, error } = await db
      .from("songs")
      .insert({
        youtube_id: data.youtubeId,
        title: data.title,
        author: data.author,
        thumbnail_url: data.thumbnail,
      })
      .select("id, youtube_id, title, author, thumbnail_url, play_count")
      .single();
    if (error) throw new Error("Não consegui salvar a música");
    return song;
  });

export const enqueueSong = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: codeSchema,
        songId: z.string().uuid(),
        singerName: z.string().trim().min(2).max(24),
        requesterToken: tokenSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await getRoomByCode(data.code);
    if (!room) throw new Error("Sala não encontrada");
    const db = await admin();
    const { error } = await db.from("queue_items").insert({
      room_id: room.id,
      song_id: data.songId,
      singer_name: data.singerName,
      requester_token: data.requesterToken,
    });
    if (error) throw new Error("Não consegui adicionar à fila");
  });

export const removeQueueItem = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: codeSchema,
        itemId: z.string().uuid(),
        requesterToken: z.string().max(128).default(""),
        hostToken: z.string().max(128).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await getRoomByCode(data.code);
    if (!room) throw new Error("Sala não encontrada");
    const db = await admin();
    const { data: item } = await db
      .from("queue_items")
      .select("id, requester_token")
      .eq("id", data.itemId)
      .eq("room_id", room.id)
      .maybeSingle();
    if (!item) return;
    const isHost = data.hostToken !== null && room.host_token === data.hostToken;
    if (!isHost && item.requester_token !== data.requesterToken) {
      throw new Error("Você só pode remover as suas músicas");
    }
    await db.from("queue_items").delete().eq("id", item.id);
  });

export const hostTogglePlay = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: codeSchema, hostToken: tokenSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await requireHost(data.code, data.hostToken);
    const db = await admin();
    await db.from("rooms").update({ is_playing: !room.is_playing }).eq("id", room.id);
  });

export const hostAdvance = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: codeSchema, hostToken: tokenSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await requireHost(data.code, data.hostToken);
    const db = await admin();
    const { data: items } = await db
      .from("queue_items")
      .select("id, status, song_id, song:songs(play_count)")
      .eq("room_id", room.id)
      .in("status", ["pending", "playing"])
      .order("position", { ascending: true });
    const queue = items ?? [];
    const current = queue.find((item) => item.status === "playing");
    if (current) {
      await db.from("queue_items").update({ status: "done" }).eq("id", current.id);
      const playCount = (current.song as { play_count: number } | null)?.play_count;
      if (typeof playCount === "number") {
        await db
          .from("songs")
          .update({ play_count: playCount + 1 })
          .eq("id", current.song_id);
      }
    }
    const next = queue.find((item) => item.status === "pending");
    if (next) {
      if (room.transition_seconds > 0 && current) {
        await db
          .from("rooms")
          .update({
            is_playing: false,
            countdown_until: new Date(Date.now() + room.transition_seconds * 1000).toISOString(),
          })
          .eq("id", room.id);
      } else {
        await db.from("queue_items").update({ status: "playing" }).eq("id", next.id);
        await db.from("rooms").update({ is_playing: true, countdown_until: null }).eq("id", room.id);
      }
    } else {
      await db.from("rooms").update({ is_playing: false, countdown_until: null }).eq("id", room.id);
    }
  });

export const hostSetTransitionSeconds = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      code: codeSchema,
      hostToken: tokenSchema,
      seconds: z.number().int().min(0).max(30),
    }).parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await requireHost(data.code, data.hostToken);
    const db = await admin();
    await db
      .from("rooms")
      .update({ transition_seconds: data.seconds })
      .eq("id", room.id);
  });
