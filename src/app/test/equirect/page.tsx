"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import {
  BackSide,
  SRGBColorSpace,
  NoToneMapping,
  type Euler,
} from "three";

const PIPELINE_BASE = "/test-assets/pipeline";

type ImageGroup = {
  label: string;
  items: { label: string; src: string; evalPrefix?: string }[];
};

const IMAGE_GROUPS: ImageGroup[] = [
  {
    label: "Stage 1: Generate (21:9 → stretch 2:1)",
    items: [
      {
        label: "Flash equirect (stretched 2:1)",
        src: `${PIPELINE_BASE}/stage1-generate/flash-equirect.png`,
        evalPrefix: "stage1-flash",
      },
    ],
  },
  {
    label: "Stage 2: Seam Fix (shift → inpaint → unshift)",
    items: [
      {
        label: "Shifted + masked (AI input)",
        src: `${PIPELINE_BASE}/stage2-seams/flash-shifted.png`,
      },
      {
        label: "Inpainted (AI output, still shifted)",
        src: `${PIPELINE_BASE}/stage2-seams/flash-inpainted.png`,
      },
      {
        label: "Flash equirect (unshifted, stretched 2:1)",
        src: `${PIPELINE_BASE}/stage2-seams/flash-equirect.png`,
        evalPrefix: "stage2-flash",
      },
    ],
  },
  {
    label: "Stage 3: Pole Fix (perspective → inpaint → reproject)",
    items: [
      {
        label: "Pole top perspective (AI input)",
        src: `${PIPELINE_BASE}/stage3-poles/flash-pole-top.png`,
      },
      {
        label: "Pole bottom perspective (AI input)",
        src: `${PIPELINE_BASE}/stage3-poles/flash-pole-bottom.png`,
      },
      {
        label: "Flash equirect (reprojected)",
        src: `${PIPELINE_BASE}/stage3-poles/flash-equirect.png`,
        evalPrefix: "stage3-flash",
      },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Synthetic Grid (4096x2048)", src: "/test-assets/equirect-grid.png" },
      { label: "HDRI Sunset (4096x2048)", src: "/test-assets/equirect-hdri.png" },
      { label: "Source benchmark image", src: `${PIPELINE_BASE}/input.png` },
    ],
  },
];

const FLAT_ITEMS = IMAGE_GROUPS.flatMap((g) => g.items);

const PIPELINE_EQUIRECTS = [
  {
    label: "Stage 1",
    src: `${PIPELINE_BASE}/stage1-generate/flash-equirect.png`,
    evalPrefix: "stage1-flash",
  },
  {
    label: "Stage 2",
    src: `${PIPELINE_BASE}/stage2-seams/flash-equirect.png`,
    evalPrefix: "stage2-flash",
  },
  {
    label: "Stage 3",
    src: `${PIPELINE_BASE}/stage3-poles/flash-equirect.png`,
    evalPrefix: "stage3-flash",
  },
];

const PROJECTION_COMPARISON = [
  {
    label: "Assuming Equirectangular",
    src: `${PIPELINE_BASE}/eval/converted-from-equirect.png`,
  },
  {
    label: "Assuming Mercator",
    src: `${PIPELINE_BASE}/eval/converted-from-mercator.png`,
  },
  {
    label: "Assuming Miller",
    src: `${PIPELINE_BASE}/eval/converted-from-miller.png`,
  },
];

function SpherePreview({ url, segments }: { url: string; segments: number }) {
  const texture = useTexture(url);
  texture.colorSpace = SRGBColorSpace;
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, segments * 2, segments]} />
      <meshBasicMaterial map={texture} side={BackSide} />
    </mesh>
  );
}

function ToneMappingController() {
  const { gl } = useThree();
  gl.toneMapping = NoToneMapping;
  gl.toneMappingExposure = 1;
  return null;
}

function SphereCanvas({
  url,
  segments,
  initialRotation,
}: {
  url: string;
  segments: number;
  initialRotation?: [number, number, number];
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 0.1], fov: 75, rotation: initialRotation as unknown as Euler }}
      frameloop="demand"
      gl={{ toneMapping: NoToneMapping }}
    >
      <Suspense fallback={null}>
        <ToneMappingController />
        <SpherePreview url={url} segments={segments} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={-0.3}
          target={[0, 0, 0]}
        />
      </Suspense>
    </Canvas>
  );
}

function EvalPanel({ evalPrefix }: { evalPrefix: string | undefined }) {
  if (!evalPrefix) {
    return (
      <div className="text-neutral-500 text-sm italic py-8 text-center">
        No evaluation artifacts for this image. Select a stage equirect to see cubemap / pole debug views.
      </div>
    );
  }

  const base = `${PIPELINE_BASE}/eval/${evalPrefix}`;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400 font-mono">Cubemap Cross</span>
        <div className="rounded border border-neutral-700 overflow-hidden bg-neutral-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}-cubemap-cross.png`} alt="Cubemap cross" className="w-full h-auto" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400 font-mono">Top Pole Face</span>
        <div className="rounded border border-neutral-700 overflow-hidden bg-neutral-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}-top.png`} alt="Top pole" className="w-full h-auto" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-neutral-400 font-mono">Bottom Pole Face</span>
        <div className="rounded border border-neutral-700 overflow-hidden bg-neutral-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}-bottom.png`} alt="Bottom pole" className="w-full h-auto" />
        </div>
      </div>
    </div>
  );
}

export default function EquirectTestPage() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [customUrl, setCustomUrl] = useState("");
  const [processedUrls, setProcessedUrls] = useState<{ label: string; src: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allItems = useMemo(() => [...FLAT_ITEMS, ...processedUrls], [processedUrls]);
  const selected = allItems[selectedIdx];
  const currentImage = customUrl || selected?.src || FLAT_ITEMS[0].src;
  const currentEvalPrefix = !customUrl ? (selected as { evalPrefix?: string })?.evalPrefix : undefined;

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setProcessedUrls((prev) => [...prev, { label: `Upload: ${file.name}`, src: url }]);
      setSelectedIdx(allItems.length);
      setCustomUrl(url);
    },
    [allItems.length],
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <h1 className="text-2xl font-bold mb-1">360 Pipeline Debug</h1>
      <p className="text-sm text-neutral-400 mb-6">
        Stage 1 (Generate) → Stage 2 (Seam Fix) → Stage 3 (Pole Fix)
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Image</label>
          <select
            value={customUrl ? "__custom" : selectedIdx}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom") return;
              setSelectedIdx(Number(v));
              setCustomUrl("");
            }}
            className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm min-w-[360px]"
          >
            {(() => {
              let globalIdx = 0;
              return IMAGE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((item) => {
                    const idx = globalIdx++;
                    return (
                      <option key={item.src} value={idx}>
                        {item.label}
                      </option>
                    );
                  })}
                </optgroup>
              ));
            })()}
            {processedUrls.map((item, i) => (
              <option key={item.src} value={FLAT_ITEMS.length + i}>
                {item.label}
              </option>
            ))}
            {customUrl && <option value="__custom">Custom upload</option>}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Upload</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-neutral-700 file:text-neutral-200 hover:file:bg-neutral-600"
          />
        </div>
      </div>

      {/* Main view: Flat + Sphere */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400 font-mono">Flat preview</span>
          <div className="rounded border border-neutral-700 overflow-hidden bg-neutral-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentImage} alt="Flat equirectangular" className="w-full h-auto" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400 font-mono">Sphere projection</span>
          <div className="h-[400px] w-full rounded border border-neutral-700 overflow-hidden bg-black">
            <SphereCanvas url={currentImage} segments={64} />
          </div>
        </div>
      </div>

      {/* Debug: Cubemap + Pole Faces */}
      <h2 className="text-lg font-semibold mb-3">Debug: Cubemap & Poles</h2>
      <div className="mb-8">
        <EvalPanel evalPrefix={currentEvalPrefix} />
      </div>

      {/* Projection Comparison: 3 spheres side by side */}
      <h2 className="text-lg font-semibold mb-3">Projection Comparison</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Raw 21:9 AI output converted to 2:1 equirect under three projection assumptions. 
        Look straight <strong>down</strong> and <strong>up</strong> to compare pole quality — the correct projection will show natural proportions.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PROJECTION_COMPARISON.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400 font-mono">{item.label}</span>
            <div className="h-[350px] w-full rounded border border-neutral-700 overflow-hidden bg-black">
              <SphereCanvas url={item.src} segments={64} />
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Comparison: 3 spheres side by side */}
      <h2 className="text-lg font-semibold mb-3">Pipeline Comparison</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Same scene at each pipeline stage. Look up/down to compare pole quality; look at the seam line (behind camera on start) to compare seam quality.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PIPELINE_EQUIRECTS.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400 font-mono">{item.label}</span>
            <div className="h-[300px] w-full rounded border border-neutral-700 overflow-hidden bg-black">
              <SphereCanvas url={item.src} segments={64} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
