import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Music, Plus, Search, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YouTubeEmbedChecker } from "@/components/YouTubeEmbedChecker";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDeviceToken, getSavedName, saveName } from "@/lib/karaoke";
import { parseYoutubeId, thumbnailFor } from "@/lib/youtube";
import { lookupYoutubeVideo } from "@/lib/youtube.functions";
import { addSong, enqueueSong, ratePerformance, removeQueueItem } from "@/lib/karaoke.functions";
import { usePerformanceRatings, useLibrary, useQueue, useRoom, type Song } from "@/hooks/useKaraokeRoom";

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
  const { data: queue = [] } = useQueue(code, Boolean(room));
  const queryClient = useQueryClient();
  const lookup = useServerFn(lookupYoutubeVideo);
  const addSongFn = useServerFn(addSong);
  const enqueueFn = useServerFn(enqueueSong);
  const removeFn = useServerFn(removeQueueItem);
  const rateFn = useServerFn(ratePerformance);

  const [name, setName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [token, setToken] = useState("");
  const [search, setSearch] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSong, setCheckingSong] = useState<Song | null>(null);

  const { data: library = [] } = useLibrary(search);

  const pending = queue.filter((item) => item.status === "pending");
  const current = queue.find((item) => item.status === "playing");
  const { data: ratings = [] } = usePerformanceRatings(code, current?.id);

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
    try {
      await enqueueFn({
        data: { code: room.code, songId: song.id, singerName: name, requesterToken: token },
      });
      queryClient.invalidateQueries({ queryKey: ["queue", code] });
      toast.success("Sua música entrou na fila!", { description: song.title });
    } catch {
      toast.error("Não consegui adicionar à fila");
    } finally {
      setBusy(false);
    }
  }

  function checkSong(song: Song) {
    if (busy) return;
    setCheckingSong(song);
  }

  function handleEmbedError(code: number) {
    setCheckingSong(null);
    const description =
      code === 101 || code === 150
        ? "O proprietário desativou a reprodução deste vídeo em outros sites."
        : code === 100
          ? "Este vídeo foi removido ou está privado."
          : code === 2
            ? "O link do vídeo é inválido."
            : "O YouTube não permitiu a reprodução deste vídeo aqui.";
    toast.error("Vídeo indisponível para o karaokê", { description });
  }

  async function handleEmbedValid() {
    if (!checkingSong) return;
    const songToQueue = checkingSong;
    setCheckingSong(null);

    if (!songToQueue.id) {
      try {
        setBusy(true);
        const song = await addSongFn({
          data: {
            youtubeId: songToQueue.youtube_id,
            title: songToQueue.title,
            author: songToQueue.author,
            thumbnail: songToQueue.thumbnail_url || thumbnailFor(songToQueue.youtube_id),
          },
        });
        setLink("");
        queryClient.invalidateQueries({ queryKey: ["library"] });
        await enqueue(song);
      } catch (error) {
        toast.error("Não consegui salvar essa música", {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    await enqueue(songToQueue);
  }

  async function addFromLink() {
    const youtubeId = parseYoutubeId(link);
    if (!youtubeId) {
      toast.error("Link do YouTube inválido");
      return;
    }
    setBusy(true);
    try {
      const info = await lookup({ data: { youtubeId } });
      setBusy(false);
      setCheckingSong({
        id: "",
        youtube_id: youtubeId,
        title: info.title,
        author: info.author,
        thumbnail_url: info.thumbnail || thumbnailFor(youtubeId),
        play_count: 0,
      });
    } catch (error) {
      toast.error("Não consegui consultar esse vídeo", {
        description: error instanceof Error ? error.message : undefined,
      });
      setBusy(false);
    }
  }

  async function removeMine(id: string) {
    if (!room) return;
    try {
      await removeFn({
        data: { code: room.code, itemId: id, requesterToken: token, hostToken: null },
      });
      queryClient.invalidateQueries({ queryKey: ["queue", code] });
    } catch {
      toast.error("Não consegui remover sua música");
    }
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

  const myRating = ratings.find((rating) => rating.rater_token === token)?.score ?? null;
  const ratingAverage = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
    : 0;

  async function rate(score: number) {
    if (!room || !current || !token) return;
    try {
      await rateFn({
        data: { code: room.code, itemId: current.id, raterToken: token, score },
      });
      queryClient.invalidateQueries({ queryKey: ["performance-ratings", code, current.id] });
      toast.success("Nota registrada!");
    } catch (error) {
      toast.error("Não consegui registrar sua nota", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 py-8">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-accent">{room.name}</p>
        <h1 className="text-4xl leading-none">Oi, {name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {current ? `Tocando: ${current.song?.title}` : "Ninguém cantando agora"}
        </p>
      </header>

      {current && (
        <section className="panel flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-xl font-semibold">Avalie quem está cantando</h2>
            <p className="text-xs text-muted-foreground">
              Sua nota é de 1 a 5 estrelas e pode ser alterada.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, index) => {
              const score = index + 1;
              return (
                <button
                  key={score}
                  type="button"
                  onClick={() => void rate(score)}
                  aria-label={`Dar nota ${score}`}
                  className="rounded-lg p-1 text-accent transition-transform hover:scale-110"
                >
                  <Star className={score <= (myRating ?? 0) ? "size-8 fill-current" : "size-8"} />
                </button>
              );
            })}
            <span className="ml-2 text-sm font-semibold">
              {ratingAverage ? ratingAverage.toFixed(1) : "—"} / 5
            </span>
            <span className="text-xs text-muted-foreground">
              ({ratings.length})
            </span>
          </div>
        </section>
      )}

      {checkingSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-5 backdrop-blur-sm">
          <section className="panel w-full max-w-xl p-5">
            <div className="mb-4">
              <p className="text-sm uppercase tracking-[0.2em] text-accent">Verificando vídeo</p>
              <h2 className="mt-1 text-2xl font-bold">{checkingSong.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Estamos verificando se o YouTube permite reproduzi-lo no karaokê antes de colocá-lo na fila.
              </p>
            </div>
            <YouTubeEmbedChecker
              videoId={checkingSong.youtube_id}
              onValid={() => void handleEmbedValid()}
              onError={handleEmbedError}
            />
            <Button
              variant="secondary"
              className="mt-4 w-full"
              disabled={busy}
              onClick={() => setCheckingSong(null)}
            >
              Cancelar
            </Button>
          </section>
        </div>
      )}

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
                <Button size="icon" className="btn-neon" disabled={busy} onClick={() => checkSong(song)}>
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
