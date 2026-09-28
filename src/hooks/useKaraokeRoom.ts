import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export type Room = {
  id: string;
  code: string;
  name: string;
  host_token: string;
  is_playing: boolean;
};

export function useRoom(code: string) {
  return useQuery({
    queryKey: ["room", code],
    queryFn: async (): Promise<Room | null> => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, code, name, host_token, is_playing")
        .eq("code", code.toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useQueue(roomId: string | undefined) {
  return useQuery({
    queryKey: ["queue", roomId],
    enabled: Boolean(roomId),
    queryFn: async (): Promise<QueueItem[]> => {
      const { data, error } = await supabase
        .from("queue_items")
        .select(
          "id, room_id, song_id, singer_name, requester_token, status, position, song:songs(id, youtube_id, title, author, thumbnail_url, play_count)",
        )
        .eq("room_id", roomId!)
        .in("status", ["pending", "playing"])
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as QueueItem[];
    },
  });
}

export function useRoomRealtime(code: string, roomId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_items", filter: `room_id=eq.${roomId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["queue", roomId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["room", code] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, code, queryClient]);
}

export function useLibrary(search: string) {
  return useQuery({
    queryKey: ["library", search],
    queryFn: async (): Promise<Song[]> => {
      let query = supabase
        .from("songs")
        .select("id, youtube_id, title, author, thumbnail_url, play_count")
        .order("play_count", { ascending: false })
        .limit(40);
      if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}
