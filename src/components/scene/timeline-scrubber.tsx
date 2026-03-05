"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Camera } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface TimelineScrubberProps {
  videoUrl: string;
  onCaptureFrame: (blob: Blob, timeSeconds: number) => void;
}

export function TimelineScrubber({ videoUrl, onCaptureFrame }: TimelineScrubberProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setDuration(video.duration);
      generateThumbnails(video);
    };
    const onTime = () => setCurrentTime(video.currentTime);
    const onEnded = () => setPlaying(false);

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
    };
  }, [videoUrl]);

  const generateThumbnails = useCallback(async (video: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx || !video.duration) return;

    canvas.width = 120;
    canvas.height = 68;
    const count = Math.min(10, Math.floor(video.duration));
    const thumbs: string[] = [];

    for (let i = 0; i < count; i++) {
      const time = (video.duration / count) * i;
      video.currentTime = time;
      await new Promise<void>((resolve) => {
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbs.push(canvas.toDataURL("image/jpeg", 0.5));
          resolve();
        };
      });
    }

    video.currentTime = 0;
    setThumbnails(thumbs);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
    } else {
      video.play();
    }
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const video = videoRef.current;
    if (!track || !video || !duration) return;

    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
    setCurrentTime(video.currentTime);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCaptureFrame(blob, video.currentTime);
    }, "image/png");
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
      <video
        ref={videoRef}
        src={videoUrl}
        crossOrigin="anonymous"
        preload="metadata"
        muted
        playsInline
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />

      {thumbnails.length > 0 && (
        <div className="relative flex h-10 overflow-hidden">
          {thumbnails.map((thumb, i) => (
            <div
              key={i}
              className="flex-1 bg-cover bg-center opacity-50"
              style={{ backgroundImage: `url(${thumb})` }}
            />
          ))}
          <div
            className="absolute left-0 top-0 h-full bg-[var(--accent-primary)]/10"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex items-center gap-3 px-3 py-2">
        <button
          onClick={togglePlay}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          {playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
        </button>

        <div
          ref={trackRef}
          onClick={seek}
          className="timeline-track flex-1 relative"
        >
          <div className="timeline-progress" style={{ width: `${progress}%` }} />
          <div className="timeline-thumb" style={{ left: `${progress}%` }} />
        </div>

        <span className="text-xs text-[var(--text-muted)] tabular-nums min-w-[70px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <button
          onClick={captureFrame}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
            "bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/20",
            "hover:bg-[var(--accent-secondary)]/20 hover:border-[var(--accent-secondary)]/40",
          )}
        >
          <Camera size={12} />
          Capture Frame
        </button>
      </div>
    </div>
  );
}
