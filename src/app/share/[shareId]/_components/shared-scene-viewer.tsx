"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Loader2 } from "lucide-react";
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

const SplatWorld = dynamic(
  () =>
    import("@/components/viewer/splat-world").then((m) => ({
      default: m.SplatWorld,
    })),
  { ssr: false },
);

type SharedScene = SceneRow & { assets: AssetRow[] };

function bestAsset(assets: AssetRow[]): {
  mode: "equirect" | "video" | "splat";
  url: string;
} | null {
  const splatFull = assets.find((a) => a.type === "splat_full");
  const splat500k = assets.find((a) => a.type === "splat_500k");
  const splat100k = assets.find((a) => a.type === "splat_100k");
  const splat = splatFull ?? splat500k ?? splat100k;
  if (splat?.public_url) return { mode: "splat", url: splat.public_url };

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

export function SharedSceneViewer({ scene }: { scene: SharedScene }) {
  const asset = useMemo(() => bestAsset(scene.assets), [scene.assets]);

  if (!asset) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-[var(--text-muted)]">
        <p>No viewable assets for this scene.</p>
      </div>
    );
  }

  if (asset.mode === "splat") {
    return (
      <div className="relative h-full w-full">
        <SplatWorld />
        <div className="absolute bottom-4 right-4 z-10">
          <a
            href={process.env.NEXT_PUBLIC_APP_URL || "/"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors border border-white/10"
          >
            Made with Dreamr
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 0.1], fov: 75 }}
        frameloop={asset.mode === "video" ? "always" : "demand"}
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

      <div className="absolute bottom-4 right-4 z-10">
        <a
          href={process.env.NEXT_PUBLIC_APP_URL || "/"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors border border-white/10"
        >
          Made with Dreamr
        </a>
      </div>

      <noscript>
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a14]">
          <Loader2 className="animate-spin text-white/40" size={24} />
        </div>
      </noscript>
    </div>
  );
}
