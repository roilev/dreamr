import { createAdminSupabase } from "./admin";
import { idColumn } from "@/lib/ids";

/**
 * Verify the caller owns the scene via its parent space.
 * Accepts UUID or short_id for sceneId.
 * Returns the scene's UUID on success, or null if not owned / not found.
 */
export async function ensureSceneOwnership(
  supabase: ReturnType<typeof createAdminSupabase>,
  sceneId: string,
  userId: string,
): Promise<string | null> {
  const { data: scene } = await supabase
    .from("scenes")
    .select("id, space_id")
    .eq(idColumn(sceneId) as never, sceneId)
    .single();
  if (!scene) return null;

  const { id, space_id: spaceId } = scene as { id: string; space_id: string };
  const { data: space } = await supabase
    .from("spaces")
    .select("id")
    .eq("id", spaceId)
    .eq("user_id", userId)
    .single();

  return space ? id : null;
}
