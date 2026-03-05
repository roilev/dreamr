import { createAdminSupabase } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { AssetRow, SceneRow } from "@/lib/supabase/types";

import { EmbedViewer } from "./_components/embed-viewer";

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

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ shareId: string }>;
  searchParams: Promise<{ autoplay?: string; quality?: string }>;
}) {
  const { shareId } = await params;
  const { autoplay, quality } = await searchParams;
  const scene = await getSharedScene(shareId);

  if (!scene) notFound();

  return (
    <div className="h-screen w-screen bg-transparent">
      <EmbedViewer
        scene={scene}
        autoplay={autoplay === "true"}
        quality={quality === "low" ? "low" : "high"}
      />
    </div>
  );
}
