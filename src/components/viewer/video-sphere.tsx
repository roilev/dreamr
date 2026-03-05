"use client";

import { useRef, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { BackSide, VideoTexture, SRGBColorSpace } from "three";
import { useViewerStore } from "@/lib/stores/viewer-store";

export function VideoSphere({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [texture, setTexture] = useState<VideoTexture | null>(null);
  const { invalidate } = useThree();
  const setVideoElement = useViewerStore((s) => s.setVideoElement);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;
    setVideoElement(video);

    let initialPlay = true;
    const onCanPlay = () => {
      if (!initialPlay) return;
      initialPlay = false;
      const tex = new VideoTexture(video);
      tex.colorSpace = SRGBColorSpace;
      setTexture(tex);
      video.play().catch(() => {});
    };
    video.addEventListener("canplay", onCanPlay);

    video.load();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.pause();
      video.src = "";
      texture?.dispose();
      setVideoElement(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, setVideoElement]);

  useEffect(() => {
    if (!texture) return;
    const video = videoRef.current;
    let raf: number;
    const loop = () => {
      texture.needsUpdate = true;
      invalidate();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onSeeked = () => {
      texture.needsUpdate = true;
      invalidate();
    };
    video?.addEventListener("seeked", onSeeked);

    return () => {
      cancelAnimationFrame(raf);
      video?.removeEventListener("seeked", onSeeked);
    };
  }, [texture, invalidate]);

  if (!texture) return null;

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 32]} />
      <meshBasicMaterial map={texture} side={BackSide} />
    </mesh>
  );
}
