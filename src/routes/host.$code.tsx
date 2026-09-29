import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Pause, Play, SkipForward, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YouTubePlayer } from "@/components/YouTubePlayer";
import { getHostToken } from "@/lib/karaoke";
import { hostAdvance, hostSetTransitionSeconds, hostTogglePlay, removeQueueItem, verifyHost } from "@/lib/karaoke.functions";
import { usePerformanceRatings, useQueue, useRoom, type QueueItem } from "@/hooks/useKaraokeRoom";

export const Route = createFileRoute("/host/$code")({
  head: () => ({
    meta: [
      { title: "Tela do anfitrião — Palco Neon" },
      {
        name: "description",
        content: "Reproduza a fila do karaokê na tela grande e mostre o QR code para os convidados.",
      },
      { property: "og:title", content: "Tela do anfitrião — Palco Neon" },
      {
        property: "og:description",
        content: "Reproduza a fila do karaokê na tela grande e mostre o QR code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HostScreen,
});

function HostScreen() {
  const { code } = Route.useParams();
  const { data: room, isLoading } = useRoom(code);
  const { data: queue = [] } = useQueue(code, Boolean(room));
  const queryClient = useQueryClient();

  const checkHost = useServerFn(verifyHost);
  const advanceFn = useServerFn(hostAdvance);
  const togglePlayFn = useServerFn(hostTogglePlay);
  const setTransitionFn = useServerFn(hostSetTransitionSeconds);
  const removeFn = useServerFn(removeQueueItem);

  const [qr, setQr] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [transitionSeconds, setTransitionSeconds] = useState(5);
  const countdownHandledRef = useRef<string | null>(null);

  const hostToken = room ? (getHostToken(room.code) ?? "") : "";

  useEffect(() => {
    if (!room) return;
    const token = getHostToken(room.code);
    if (token) {
      void checkHost({ data: { code: room.code, hostToken: token } })
        .then(setIsHost)
        .catch(() => setIsHost(false));
    } else {
      setIsHost(false);
    }
    const url = `${window.location.origin}/r/${room.code}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      color: { dark: "#0d1224", light: "#ffffff" },
    }).then(setQr);
  }, [room, checkHost]);

  const current = queue.find((item) => item.status === "playing") ?? null;
  const pending = queue.filter((item) => item.status === "pending");
  const { data: ratings = [] } = usePerformanceRatings(code, current?.id);
  const ratingAverage = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
    : 0;

  useEffect(() => {
    if (!room) return;
    setTransitionSeconds(room.transition_seconds);
  }, [room?.id, room?.transition_seconds]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["queue", code] });
    queryClient.invalidateQueries({ queryKey: ["room", code] });
  }, [queryClient, code]);

  const advance = useCallback(async () => {
    if (!room || !isHost) return;
    try {
      await advanceFn({ data: { code: room.code, hostToken } });
      refresh();
    } catch {
      toast.error("Não consegui avançar a fila");
    }
  }, [room, isHost, hostToken, advanceFn, refresh]);

  async function setTransition() {
    if (!room || !isHost) return;
    try {
      await setTransitionFn({ data: { code: room.code, hostToken, seconds: transitionSeconds } });
      refresh();
      toast.success("Contagem entre músicas atualizada");
    } catch {
      toast.error("Não consegui salvar a contagem");
    }
  }

  useEffect(() => {
    if (!room?.countdown_until) {
      setCountdown(0);
      countdownHandledRef.current = null;
      return;
    }

    const countdownId = room.countdown_until;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(countdownId).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0 && countdownHandledRef.current !== countdownId && isHost) {
        countdownHandledRef.current = countdownId;
        void advance();
      }
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [room?.countdown_until, isHost, advance]);

  async function togglePlay() {
    if (!room || !isHost) return;
    try {
      await togglePlayFn({ data: { code: room.code, hostToken } });
      refresh();
    } catch {
      toast.error("Não consegui alternar a reprodução");
    }
  }

  async function removeItem(item: QueueItem) {
    if (!room) return;
    try {
      await removeFn({
        data: { code: room.code, itemId: item.id, requesterToken: "", hostToken },
      });
      refresh();
    } catch {
      toast.error("Não consegui remover da fila");
    }
  }

  if (isLoading) {
    return <CenteredMessage title="Carregando..." />;
  }

  if (!room) {
    return (
      <CenteredMessage
        title="Sala não encontrada"
        description={`Nenhuma sala com o código ${code.toUpperCase()}.`}
      />
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1.7fr_1fr]">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl leading-none">{room.name}</h1>
          <p className="text-sm text-muted-foreground">
            {current
              ? `Cantando agora: ${current.singer_name}`
              : "Ninguém na vez — mande uma música pelo celular"}
          </p>
        </div>

        <YouTubePlayer
          videoId={current?.song?.youtube_id ?? null}
          playing={room.is_playing}
          onEnded={advance}
        />

        {countdown > 0 && (
          <div className="panel flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
              Próxima música em
            </p>
            <p className="text-7xl font-black leading-none text-accent">{countdown}</p>
            <p className="text-lg font-semibold">
              {pending[0]?.singer_name ? "Prepare-se, " + pending[0].singer_name + "!" : "Prepare-se!"}
            </p>
          </div>
        )}

        {current && (
          <div className="panel flex items-center gap-3 p-4">
            <div className="flex items-center gap-1 text-accent">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  className={index < Math.round(ratingAverage) ? "size-5 fill-current" : "size-5"}
                />
              ))}
            </div>
            <span className="text-sm font-semibold">
              {ratingAverage ? ratingAverage.toFixed(1) : "—"} / 5
            </span>
            <span className="text-xs text-muted-foreground">
              {ratings.length} {ratings.length === 1 ? "avaliação" : "avaliações"}
            </span>
          </div>
        )}

        <div className="panel flex flex-wrap items-center gap-3 p-4">
          <Button className="btn-neon h-12 px-6 font-bold" onClick={togglePlay} disabled={!isHost}>
            {room.is_playing ? <Pause className="mr-2 size-5" /> : <Play className="mr-2 size-5" />}
            {room.is_playing ? "Pausar" : "Tocar"}
          </Button>
          <Button variant="secondary" className="h-12 px-6 font-bold" onClick={advance} disabled={!isHost}>
            <SkipForward className="mr-2 size-5" />
            Próxima
          </Button>
          <div className="min-w-0 flex-1 text-right text-sm text-muted-foreground">
            {current?.song?.title ?? "—"}
          </div>
        </div>

        {!isHost && (
          <p className="text-sm text-accent">
            Este navegador não é o anfitrião desta sala, então os controles ficam bloqueados.
          </p>
        )}
      </section>

      <aside className="flex flex-col gap-6">
        <div className="panel flex flex-col items-center gap-3 p-6 text-center">
          <h2 className="text-2xl">Entre pelo celular</h2>
          {qr && (
            <img src={qr} alt="QR code para entrar na sala" className="w-48 rounded-xl bg-white p-2" />
          )}
          <p className="text-4xl font-bold tracking-[0.3em] text-accent">{room.code}</p>
          <Link
            to="/r/$code"
            params={{ code: room.code }}
            className="break-all text-xs text-muted-foreground underline"
          >
            {joinUrl}
          </Link>
        </div>

        <div className="panel flex flex-col gap-3 p-5">
          <h2 className="text-2xl">Intervalo entre músicas</h2>
          <p className="text-sm text-muted-foreground">
            Após uma música terminar, aguarde alguns segundos antes da próxima começar.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={30}
              value={transitionSeconds}
              onChange={(e) => setTransitionSeconds(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
              className="h-11 w-24 rounded-xl border border-border bg-secondary px-3 text-lg font-bold"
            />
            <span className="text-sm text-muted-foreground">segundos</span>
            <Button className="btn-neon ml-auto" onClick={() => void setTransition()}>
              Salvar
            </Button>
          </div>
        </div>

        <div className="panel flex flex-col gap-3 p-5">
          <h2 className="text-2xl">Fila ({pending.length})</h2>
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">A fila está vazia por enquanto.</p>
          )}
          <ul className="flex flex-col gap-2">
            {pending.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl bg-secondary/60 p-2 pr-3"
              >
                <span className="w-6 text-center font-bold text-accent">{index + 1}</span>
                {item.song?.thumbnail_url && (
                  <img
                    src={item.song.thumbnail_url}
                    alt=""
                    className="h-10 w-16 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.song?.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.singer_name}</p>
                </div>
                {isHost && (
                  <button
                    onClick={() => removeItem(item)}
                    aria-label="Remover da fila"
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}

function CenteredMessage({ title, description }: { title: string; description?: string }) {
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
