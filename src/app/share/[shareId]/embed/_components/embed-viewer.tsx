"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { AssetRow, SceneRow } from "@/lib/supabase/types";
import dynamic from "next/dynamic";

const EquirectView = dynamic(
  () =>
    import("@/components/viewer/equirect-view").then((m) => ({
      default: m.EquirectView,
    })),
  { ssr: false },
);

const VideoSphere = dynamic(
  () =>
    import("@/components/viewer/video-sphere").then((m) => ({
      default: m.VideoSphere,
    })),
  { ssr: false },
);

type SharedScene = SceneRow & { assets: AssetRow[] };

function bestAsset(assets: AssetRow[]): {
  mode: "equirect" | "video";
  url: string;
} | null {
  const video = assets.find(
    (a) => a.type === "video" || a.type === "upscaled_video",
  );
  if (video?.public_url) return { mode: "video", url: video.public_url };

  const equirect = assets.find((a) => a.type === "equirect_image");
  if (equirect?.public_url)
    return { mode: "equirect", url: equirect.public_url };

  const thumbnail = assets.find((a) => a.type === "thumbnail");
  if (thumbnail?.public_url)
    return { mode: "equirect", url: thumbnail.public_url };

  return null;
}

function ViewerScene({ asset }: { asset: { mode: string; url: string } }) {
  if (asset.mode === "video") {
    return <VideoSphere key={asset.url} url={asset.url} />;
  }
  return <EquirectView url={asset.url} />;
}

interface EmbedViewerProps {
  scene: SharedScene;
  autoplay: boolean;
  quality: "low" | "high";
}

export function EmbedViewer({ scene, autoplay }: EmbedViewerProps) {
  const asset = useMemo(() => bestAsset(scene.assets), [scene.assets]);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "dreamr:ping") {
        window.parent.postMessage({ type: "dreamr:pong", sceneId: scene.id }, "*");
      }
    }
    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "dreamr:ready", sceneId: scene.id }, "*");
    return () => window.removeEventListener("message", handleMessage);
  }, [scene.id]);

  if (!asset) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-white/40 bg-black">
        <p>No viewable assets.</p>
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 0.1], fov: 75 }}
      frameloop={asset.mode === "video" || autoplay ? "always" : "demand"}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <ViewerScene asset={asset} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={-0.3}
          touches={{ ONE: 1, TWO: 2 }}
          target={[0, 0, 0]}
        />
      </Suspense>
    </Canvas>
  );
}
