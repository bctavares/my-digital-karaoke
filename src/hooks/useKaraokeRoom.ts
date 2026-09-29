import { useQuery } from "@tanstack/react-query";
import {
  getQueue,
  getRoom,
  searchLibrary,
  type PublicRoom,
  type QueueItem,
  type Song,
} from "@/lib/karaoke.functions";

export type { PublicRoom as Room, QueueItem, Song };

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

export function useLibrary(search: string) {
  return useQuery({
    queryKey: ["library", search],
    queryFn: (): Promise<Song[]> => searchLibrary({ data: { search } }),
  });
}
