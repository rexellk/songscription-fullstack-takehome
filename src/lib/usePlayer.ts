"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { play, player, stop, type PlayerState, type Surface } from "@/lib/player";
import { track } from "@/lib/track";
import type { PreviewNote } from "@/types";

/**
 * Playback state for one song on one surface. Every card subscribes, but only the
 * card that's playing runs an animation frame loop for its playhead.
 */
export function usePreview(songId: string, surface: Surface, notes: PreviewNote[], seconds: number) {
  const state = useSyncExternalStore(player.subscribe, player.getState, player.getState);
  const mine = "songId" in state && state.songId === songId && state.surface === surface;
  const status: PlayerState["status"] = mine ? state.status : "idle";
  const [position, setPosition] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "playing") {
      setPosition(null);
      return;
    }
    let frame = 0;
    const tick = () => {
      setPosition(player.position());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status]);

  useEffect(() => {
    if (status === "error") toast.error("We couldn't load the piano sound. Check your connection and try again.");
  }, [status]);

  const toggle = useCallback(async () => {
    if (status === "playing" || status === "loading") {
      stop();
      return;
    }
    track("preview_played", { surface }, { songId });
    await play(songId, surface, notes, seconds);
  }, [status, songId, surface, notes, seconds]);

  return { status, position, toggle };
}

/** Closing the drawer or deleting a song shouldn't leave music playing. */
export function stopPreview() {
  stop();
}
