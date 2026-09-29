import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getQueue,
  getRoom,
  searchLibrary,
  type PerformanceRating,
  type PublicRoom,
  type QueueItem,
  type Song,
} from "@/lib/karaoke.functions";

export type { PublicRoom as Room, QueueItem, Song, PerformanceRating };

const REFETCH_MS = 3000;

export function useRoom(code: string) {
  return useQuery({
    queryKey: ["room", code],
    queryFn: (): Promise<PublicRoom | null> => getRoom({ data: { code } }),
    refetchInterval: REFETCH_MS,
  });
}

export function useQueue(code: string, enabled: boolean) {
  return useQuery({
    queryKey: ["queue", code],
    enabled,
    queryFn: (): Promise<QueueItem[]> => getQueue({ data: { code } }),
    refetchInterval: REFETCH_MS,
  });
}

export function usePerformanceRatings(code: string, queueItemId: string | undefined) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return useQuery({
    queryKey: ["performance-ratings", code, queueItemId],
    enabled: mounted && Boolean(queueItemId),
    queryFn: async (): Promise<PerformanceRating[]> => {
      const { data, error } = await supabase
        .from("performance_ratings")
        .select("id, queue_item_id, rater_token, score, created_at")
        .eq("queue_item_id", queueItemId!)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro ao carregar avaliações:", error);
        return [];
      }

      return (data ?? []) as PerformanceRating[];
    },
    refetchInterval: REFETCH_MS,
  });
}

export function useLibrary(search: string) {
  return useQuery({
    queryKey: ["library", search],
    queryFn: (): Promise<Song[]> => searchLibrary({ data: { search } }),
  });
}
