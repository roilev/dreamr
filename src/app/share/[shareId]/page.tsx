import { createAdminSupabase } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { AssetRow, SceneRow } from "@/lib/supabase/types";

import { SharedSceneViewer } from "./_components/shared-scene-viewer";
import { SharedSceneHeader } from "./_components/shared-scene-header";

type SharedScene = SceneRow & { assets: AssetRow[] };

async function getSharedScene(shareId: string): Promise<SharedScene | null> {
  const supabase = createAdminSupabase();

  const { data: scene } = await supabase
    .from("scenes")
    .select("*")
    .eq("share_token", shareId)
    .single();

  if (!scene) return null;

  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .eq("scene_id", (scene as SceneRow).id)
    .order("created_at");

  return {
    ...(scene as SceneRow),
    assets: (assets ?? []) as AssetRow[],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const scene = await getSharedScene(shareId);

  if (!scene) return { title: "Dreamr" };

  return {
    title: `${scene.name} | Dreamr`,
    description: scene.prompt || "An AI-generated world on Dreamr",
    openGraph: {
      title: `${scene.name} | Dreamr`,
      description: scene.prompt || "An AI-generated world on Dreamr",
      images: scene.thumbnail_url ? [{ url: scene.thumbnail_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function SharedScenePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const scene = await getSharedScene(shareId);

  if (!scene) notFound();

  return (
    <div className="h-screen w-screen bg-[#0a0a14]">
      <SharedSceneViewer scene={scene} />
      <SharedSceneHeader name={scene.name} prompt={scene.prompt} />
    </div>
  );
}
