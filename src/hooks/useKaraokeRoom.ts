import { useQuery } from "@tanstack/react-query";
import {
  getPerformanceRatings,
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
  return useQuery({
    queryKey: ["performance-ratings", code, queueItemId],
    enabled: Boolean(queueItemId),
    queryFn: (): Promise<PerformanceRating[]> =>
      getPerformanceRatings({ data: { code, itemId: queueItemId! } }),
    refetchInterval: REFETCH_MS,
  });
}

export function useLibrary(search: string) {
  return useQuery({
    queryKey: ["library", search],
    queryFn: (): Promise<Song[]> => searchLibrary({ data: { search } }),
  });
}
