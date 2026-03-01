"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import { Music } from "lucide-react";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SongRequestOverlay() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: song } = useQuery({
    ...trpc.songRequest.publicCurrent.queryOptions(),
    refetchInterval: 5000,
  });

  if (!mounted) return null;

  if (!song) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4">
      <div className="flex items-center gap-3 rounded-lg bg-black/80 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
        {song.youtubeThumbnail && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={song.youtubeThumbnail}
            alt=""
            className="h-12 w-20 shrink-0 rounded object-cover"
          />
        )}
        <div className="min-w-0 max-w-xs">
          <div className="flex items-center gap-2">
            <Music className="size-3.5 shrink-0 text-sky-400" />
            <p className="truncate text-sm font-medium">{song.title}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>Requested by {song.requestedBy}</span>
            {song.youtubeDuration && (
              <>
                <span>&middot;</span>
                <span>{formatDuration(song.youtubeDuration)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
