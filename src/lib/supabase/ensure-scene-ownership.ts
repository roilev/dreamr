import { createAdminSupabase } from "./admin";

export async function ensureSceneOwnership(
  supabase: ReturnType<typeof createAdminSupabase>,
  sceneId: string,
  userId: string,
): Promise<boolean> {
  const { data: scene } = await supabase
    .from("scenes")
    .select("project_id")
    .eq("id", sceneId)
    .single();
  if (!scene) return false;

  const projectId = (scene as { project_id: string }).project_id;
  const { data: space } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  return !!space;
}
