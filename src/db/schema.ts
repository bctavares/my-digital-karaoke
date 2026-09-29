import {
  bigint,
  boolean,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const songs = pgTable("songs", {
  id: uuid("id").primaryKey().defaultRandom(),
  youtubeId: text("youtube_id").notNull().unique(),
  title: text("title").notNull(),
  author: text("author"),
  thumbnailUrl: text("thumbnail_url"),
  playCount: integer("play_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull().default("Karaoke"),
  hostToken: text("host_token").notNull(),
  isPlaying: boolean("is_playing").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  transitionSeconds: smallint("transition_seconds").notNull().default(5),
  countdownUntil: timestamp("countdown_until", { withTimezone: true }),
});

export const queueItems = pgTable("queue_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  songId: uuid("song_id").notNull().references(() => songs.id, { onDelete: "cascade" }),
  singerName: text("singer_name").notNull(),
  requesterToken: text("requester_token").notNull(),
  status: text("status").notNull().default("pending"),
  position: bigint("position", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const performanceRatings = pgTable(
  "performance_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queueItemId: uuid("queue_item_id").notNull().references(() => queueItems.id, { onDelete: "cascade" }),
    raterToken: text("rater_token").notNull(),
    score: smallint("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    queueItemRaterUnique: unique("performance_ratings_queue_item_rater_unique").on(
      table.queueItemId,
      table.raterToken,
    ),
  }),
);

export type Song = typeof songs.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type QueueItem = typeof queueItems.$inferSelect;
export type PerformanceRating = typeof performanceRatings.$inferSelect;
