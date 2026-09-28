import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Music, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDeviceToken, getSavedName, saveName } from "@/lib/karaoke";
import { parseYoutubeId, thumbnailFor } from "@/lib/youtube";
import { lookupYoutubeVideo } from "@/lib/youtube.functions";
import { useLibrary, useQueue, useRoom, useRoomRealtime, type Song } from "@/hooks/useKaraokeRoom";

export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [
      { title: "Escolher música — Palco Neon" },
      {
        name: "description",
        content: "Entre na sala de karaokê, escolha uma música da biblioteca ou cole um link novo.",
      },
      { property: "og:title", content: "Escolher música — Palco Neon" },
      {
        property: "og:description",
        content: "Escolha uma música da biblioteca ou cole um link novo e entre na fila.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuestScreen,
});

function GuestScreen() {
  const { code } = Route.useParams();
  const { data: room, isLoading } = useRoom(code);
  const { data: queue = [] } = useQueue(room?.id);
  useRoomRealtime(code, room?.id);
  const queryClient = useQueryClient();
  const lookup = useServerFn(lookupYoutubeVideo);

  const [name, setName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [token, setToken] = useState("");
  const [search, setSearch] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: library = [] } = useLibrary(search);

  useEffect(() => {
    setToken(getDeviceToken());
    const saved = getSavedName();
    if (saved) {
      setName(saved);
      setNameConfirmed(true);
    }
  }, []);

  async function enqueue(song: Song) {
    if (!room) return;
    setBusy(true);
    const { error } = await supabase.from("queue_items").insert({
      room_id: room.id,
      song_id: song.id,
      singer_name: name,
      requester_token: token,
    });
    setBusy(false);
    if (error) {
      toast.error("Não consegui adicionar à fila");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["queue", room.id] });
    toast.success("Sua música entrou na fila!", { description: song.title });
  }

  async function addFromLink() {
    const youtubeId = parseYoutubeId(link);
    if (!youtubeId) {
      toast.error("Link do YouTube inválido");
      return;
    }
    setBusy(true);
    try {
      const existing = await supabase
        .from("songs")
        .select("id, youtube_id, title, author, thumbnail_url, play_count")
        .eq("youtube_id", youtubeId)
        .maybeSingle();

      let song = existing.data as Song | null;
      if (!song) {
        const info = await lookup({ data: { youtubeId } });
        const inserted = await supabase
          .from("songs")
          .insert({
            youtube_id: youtubeId,
            title: info.title,
            author: info.author,
            thumbnail_url: info.thumbnail || thumbnailFor(youtubeId),
          })
          .select("id, youtube_id, title, author, thumbnail_url, play_count")
          .single();
        if (inserted.error) throw inserted.error;
        song = inserted.data as Song;
      }
      setLink("");
      queryClient.invalidateQueries({ queryKey: ["library"] });
      await enqueue(song);
    } catch (error) {
      toast.error("Não consegui adicionar essa música", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeMine(id: string) {
    await supabase.from("queue_items").delete().eq("id", id).eq("requester_token", token);
    if (room) queryClient.invalidateQueries({ queryKey: ["queue", room.id] });
  }

  if (isLoading) {
    return <Centered title="Carregando..." />;
  }

  if (!room) {
    return <Centered title="Sala não encontrada" description={`Código ${code.toUpperCase()}`} />;
  }

  if (!nameConfirmed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-5">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">{room.name}</p>
          <h1 className="text-5xl leading-none">Como te chamamos?</h1>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome"
          maxLength={24}
          className="h-12 text-lg"
        />
        <Button
          className="btn-neon h-12 font-bold"
          disabled={name.trim().length < 2}
          onClick={() => {
            saveName(name.trim());
            setNameConfirmed(true);
          }}
        >
          Entrar na festa
        </Button>
      </main>
    );
  }

  const pending = queue.filter((item) => item.status === "pending");
  const current = queue.find((item) => item.status === "playing");

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-8">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-accent">{room.name}</p>
        <h1 className="text-4xl leading-none">Oi, {name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {current ? `Tocando: ${current.song?.title}` : "Ninguém cantando agora"}
        </p>
      </header>

      <Tabs defaultValue="library">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="library">Biblioteca</TabsTrigger>
          <TabsTrigger value="link">Novo link</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar música já usada"
              className="pl-9"
            />
          </div>
          {library.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma música ainda. Use a aba "Novo link" para adicionar a primeira.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {library.map((song) => (
              <li key={song.id} className="panel flex items-center gap-3 p-2 pr-3">
                <img
                  src={song.thumbnail_url ?? thumbnailFor(song.youtube_id)}
                  alt=""
                  className="h-12 w-20 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{song.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{song.author}</p>
                </div>
                <Button size="icon" className="btn-neon" disabled={busy} onClick={() => enqueue(song)}>
                  <Plus className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="link" className="mt-4 flex flex-col gap-3">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Cole o link do YouTube"
          />
          <Button className="btn-neon h-12 font-bold" disabled={busy} onClick={addFromLink}>
            <Music className="mr-2 size-4" />
            Adicionar e entrar na fila
          </Button>
          <p className="text-xs text-muted-foreground">
            A música fica salva na biblioteca para as próximas festas.
          </p>
        </TabsContent>
      </Tabs>

      <section className="panel flex flex-col gap-2 p-4">
        <h2 className="text-2xl">Fila ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Fila vazia.</p>}
        {pending.map((item, index) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-2 pr-3">
            <span className="w-5 text-center font-bold text-accent">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.song?.title}</p>
              <p className="truncate text-xs text-muted-foreground">{item.singer_name}</p>
            </div>
            {item.requester_token === token && (
              <button
                onClick={() => removeMine(item.id)}
                aria-label="Remover minha música"
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </section>

      <Link to="/" className="text-center text-xs text-muted-foreground underline">
        Sair da sala
      </Link>
    </main>
  );
}

function Centered({ title, description }: { title: string; description?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-5 text-center">
      <h1 className="text-4xl">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
      <Link to="/" className="mt-4 text-accent underline">
        Voltar ao início
      </Link>
    </main>
  );
}
