import { useEffect, useRef } from "react";

type YTPlayer = {
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
  videoId: string;
  onValid: () => void;
  onError: (code: number) => void;
};

export function YouTubeEmbedChecker({ videoId, onValid, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const settledRef = useRef(false);
  const validRef = useRef(onValid);
  const errorRef = useRef(onError);

  validRef.current = onValid;
  errorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (!cancelled && !settledRef.current) {
        settledRef.current = true;
        errorRef.current(0);
      }
    }, 10000);

    loadApi().then(() => {
      if (cancelled || !containerRef.current || playerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        width: "480",
        height: "270",
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (!settledRef.current) {
              settledRef.current = true;
              window.clearTimeout(timeout);
              validRef.current();
            }
          },
          onError: (event: { data: number }) => {
            if (!settledRef.current) {
              settledRef.current = true;
              window.clearTimeout(timeout);
              errorRef.current(event.data);
            }
          },
        },
      });
    }).catch(() => {
      if (!settledRef.current) {
        settledRef.current = true;
        window.clearTimeout(timeout);
        errorRef.current(0);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  return <div ref={containerRef} className="aspect-video w-full overflow-hidden rounded-xl bg-secondary" />;
}
