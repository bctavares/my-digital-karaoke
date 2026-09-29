import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { performanceRatings, queueItems, rooms, songs } from "@/db/schema";

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

async function getDb() {
  const { getDb: createDb } = await import("@/db/client");
  return createDb();
}

async function getRoomByCode(code: string) {
  const db = await getDb();
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return room ?? null;
}

async function requireHost(code: string, hostToken: string) {
  const room = await getRoomByCode(code);
  if (!room) throw new Error("Sala não encontrada");
  if (room.hostToken !== hostToken) throw new Error("Você não é o anfitrião desta sala");
  return room;
}

function toPublicRoom(room: typeof rooms.$inferSelect): PublicRoom {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    is_playing: room.isPlaying,
    transition_seconds: room.transitionSeconds,
    countdown_until: room.countdownUntil?.toISOString() ?? null,
  };
}

function toSong(song: typeof songs.$inferSelect): Song {
  return {
    id: song.id,
    youtube_id: song.youtubeId,
    title: song.title,
    author: song.author,
    thumbnail_url: song.thumbnailUrl,
    play_count: song.playCount,
  };
}

function toQueueItem(item: typeof queueItems.$inferSelect, song: typeof songs.$inferSelect | null): QueueItem {
  return {
    id: item.id,
    room_id: item.roomId,
    song_id: item.songId,
    singer_name: item.singerName,
    requester_token: item.requesterToken,
    status: item.status,
    position: item.position,
    song: song ? toSong(song) : null,
  };
}

function toRating(rating: typeof performanceRatings.$inferSelect): PerformanceRating {
  return {
    id: rating.id,
    queue_item_id: rating.queueItemId,
    rater_token: rating.raterToken,
    score: rating.score,
    created_at: rating.createdAt.toISOString(),
  };
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      name: z.string().trim().max(40).default(""),
      code: codeSchema,
      hostToken: tokenSchema,
    }).parse(data),
  )
  .handler(async ({ data }): Promise<PublicRoom> => {
    const db = await getDb();
    try {
      const [room] = await db.insert(rooms).values({
        code: data.code,
        name: data.name || "Karaokê",
        hostToken: data.hostToken,
      }).returning();
      if (!room) throw new Error("Não foi possível criar a sala");
      return toPublicRoom(room);
    } catch (error) {
      if (error instanceof Error && error.message.includes("rooms_code_key")) {
        throw new Error("Código em uso, tente outro");
      }
      throw error;
    }
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
    return Boolean(room && room.hostToken === data.hostToken);
  });

export const getQueue = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ code: codeSchema }).parse(data))
  .handler(async ({ data }): Promise<QueueItem[]> => {
    const room = await getRoomByCode(data.code);
    if (!room) return [];
    const db = await getDb();
    const rows = await db
      .select({ item: queueItems, song: songs })
      .from(queueItems)
      .leftJoin(songs, eq(queueItems.songId, songs.id))
      .where(and(eq(queueItems.roomId, room.id), inArray(queueItems.status, ["pending", "playing"])))
      .orderBy(asc(queueItems.position), asc(queueItems.createdAt));
    return rows.map(({ item, song }) => toQueueItem(item, song));
  });

export const getPerformanceRatings = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ code: codeSchema, itemId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<PerformanceRating[]> => {
    const room = await getRoomByCode(data.code);
    if (!room) return [];
    const db = await getDb();
    const [item] = await db
      .select({ id: queueItems.id })
      .from(queueItems)
      .where(and(eq(queueItems.id, data.itemId), eq(queueItems.roomId, room.id)))
      .limit(1);
    if (!item) throw new Error("Apresentação não encontrada");
    const ratings = await db
      .select()
      .from(performanceRatings)
      .where(eq(performanceRatings.queueItemId, data.itemId))
      .orderBy(asc(performanceRatings.createdAt));
    return ratings.map(toRating);
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
    const db = await getDb();
    const [item] = await db
      .select({ id: queueItems.id, status: queueItems.status })
      .from(queueItems)
      .where(and(eq(queueItems.id, data.itemId), eq(queueItems.roomId, room.id)))
      .limit(1);
    if (!item) throw new Error("Apresentação não encontrada");
    if (!["playing", "done"].includes(item.status)) {
      throw new Error("Essa apresentação ainda não está disponível para avaliação");
    }
    await db
      .insert(performanceRatings)
      .values({
        queueItemId: data.itemId,
        raterToken: data.raterToken,
        score: data.score,
      })
      .onConflictDoUpdate({
        target: [performanceRatings.queueItemId, performanceRatings.raterToken],
        set: { score: data.score },
      });
  });

export const searchLibrary = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ search: z.string().trim().max(80).default("") }).parse(data),
  )
  .handler(async ({ data }): Promise<Song[]> => {
    const db = await getDb();
    const query = db
      .select()
      .from(songs)
      .orderBy(desc(songs.playCount), desc(songs.createdAt))
      .limit(40);
    const result = data.search
      ? await query.where(ilike(songs.title, `%${data.search}%`))
      : await query;
    return result.map(toSong);
  });

export const addSong = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      youtubeId: z.string().regex(/^[\w-]{11}$/, "ID de vídeo inválido"),
      title: z.string().trim().min(1).max(200),
      author: z.string().trim().max(120).nullable().default(null),
      thumbnail: z.string().url().max(500).nullable().default(null),
    }).parse(data),
  )
  .handler(async ({ data }): Promise<Song> => {
    const db = await getDb();
    await db.insert(songs).values({
      youtubeId: data.youtubeId,
      title: data.title,
      author: data.author,
      thumbnailUrl: data.thumbnail,
    }).onConflictDoNothing({ target: songs.youtubeId });
    const [song] = await db.select().from(songs).where(eq(songs.youtubeId, data.youtubeId)).limit(1);
    if (!song) throw new Error("Não consegui salvar a música");
    return toSong(song);
  });

export const enqueueSong = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      code: codeSchema,
      songId: z.string().uuid(),
      singerName: z.string().trim().min(2).max(24),
      requesterToken: tokenSchema,
    }).parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await getRoomByCode(data.code);
    if (!room) throw new Error("Sala não encontrada");
    const db = await getDb();

    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${room.id}::text))`);
      const [lockedRoom] = await tx.select().from(rooms).where(eq(rooms.id, room.id)).limit(1);
      if (!lockedRoom) throw new Error("Sala não encontrada");

      const [playing] = await tx
        .select({ id: queueItems.id })
        .from(queueItems)
        .where(and(eq(queueItems.roomId, room.id), eq(queueItems.status, "playing")))
        .limit(1);

      const countdownActive =
        lockedRoom.countdownUntil !== null && lockedRoom.countdownUntil.getTime() > Date.now();

      await tx.insert(queueItems).values({
        roomId: room.id,
        songId: data.songId,
        singerName: data.singerName,
        requesterToken: data.requesterToken,
        status: !playing && !countdownActive ? "playing" : "pending",
      });

      if (!playing && !countdownActive) {
        await tx.update(rooms).set({ isPlaying: true, countdownUntil: null }).where(eq(rooms.id, room.id));
      }
    });
  });

export const removeQueueItem = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      code: codeSchema,
      itemId: z.string().uuid(),
      requesterToken: z.string().max(128).default(""),
      hostToken: z.string().max(128).nullable().default(null),
    }).parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await getRoomByCode(data.code);
    if (!room) throw new Error("Sala não encontrada");
    const db = await getDb();
    const [item] = await db
      .select({ id: queueItems.id, requesterToken: queueItems.requesterToken })
      .from(queueItems)
      .where(and(eq(queueItems.id, data.itemId), eq(queueItems.roomId, room.id)))
      .limit(1);
    if (!item) return;
    const isHost = data.hostToken !== null && room.hostToken === data.hostToken;
    if (!isHost && item.requesterToken !== data.requesterToken) {
      throw new Error("Você só pode remover as suas músicas");
    }
    await db.delete(queueItems).where(eq(queueItems.id, item.id));
  });

export const hostTogglePlay = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: codeSchema, hostToken: tokenSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await requireHost(data.code, data.hostToken);
    const db = await getDb();
    await db.update(rooms).set({ isPlaying: !room.isPlaying }).where(eq(rooms.id, room.id));
  });

export const hostAdvance = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: codeSchema, hostToken: tokenSchema }).parse(data),
  )
  .handler(async ({ data }): Promise<void> => {
    const room = await requireHost(data.code, data.hostToken);
    const db = await getDb();

    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${room.id}::text))`);
      const [lockedRoom] = await tx.select().from(rooms).where(eq(rooms.id, room.id)).limit(1);
      if (!lockedRoom) throw new Error("Sala não encontrada");

      const rows = await tx
        .select({ item: queueItems, song: songs })
        .from(queueItems)
        .leftJoin(songs, eq(queueItems.songId, songs.id))
        .where(and(eq(queueItems.roomId, room.id), inArray(queueItems.status, ["pending", "playing"])))
        .orderBy(asc(queueItems.position), asc(queueItems.createdAt));

      const current = rows.find((row) => row.item.status === "playing")?.item;
      if (current) {
        await tx.update(queueItems).set({ status: "done" }).where(eq(queueItems.id, current.id));
        await tx
          .update(songs)
          .set({ playCount: sql`${songs.playCount} + 1` })
          .where(eq(songs.id, current.songId));
      }

      const next = rows.find((row) => row.item.status === "pending")?.item;
      if (!next) {
        await tx.update(rooms).set({ isPlaying: false, countdownUntil: null }).where(eq(rooms.id, room.id));
        return;
      }

      if (lockedRoom.transitionSeconds > 0 && current) {
        await tx.update(rooms).set({
          isPlaying: false,
          countdownUntil: new Date(Date.now() + lockedRoom.transitionSeconds * 1000),
        }).where(eq(rooms.id, room.id));
      } else {
        await tx.update(queueItems).set({ status: "playing" }).where(eq(queueItems.id, next.id));
        await tx.update(rooms).set({ isPlaying: true, countdownUntil: null }).where(eq(rooms.id, room.id));
      }
    });
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
    const db = await getDb();
    await db.update(rooms).set({ transitionSeconds: data.seconds }).where(eq(rooms.id, room.id));
  });
