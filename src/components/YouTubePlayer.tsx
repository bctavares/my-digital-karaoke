import { useEffect, useRef } from "react";

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  loadVideoById: (id: string) => void;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

type Props = {
  videoId: string | null;
  playing: boolean;
  onEnded: () => void;
};

export function YouTubePlayer({ videoId, playing, onEnded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const currentId = useRef<string | null>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    let cancelled = false;

    loadApi().then(() => {
      if (cancelled || !containerRef.current || playerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            if (currentId.current) {
              playerRef.current?.loadVideoById(currentId.current);
            }
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === 0) endedRef.current();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!videoId || videoId === currentId.current) return;
    currentId.current = videoId;
    playerRef.current?.loadVideoById(videoId);
  }, [videoId]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (playing) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
  }, [playing, videoId]);

  return (
    <div className="relative min-h-[55vh] w-full overflow-hidden rounded-2xl bg-secondary lg:min-h-[70vh]">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {!videoId && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          A fila está vazia — peça uma música pelo celular
        </div>
      )}
    </div>
  );
}
