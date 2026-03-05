-- Rename projects table to spaces
ALTER TABLE public.projects RENAME TO spaces;

-- Rename the foreign key column in scenes
ALTER TABLE public.scenes RENAME COLUMN project_id TO space_id;

-- Rename indexes
ALTER INDEX idx_projects_user_id RENAME TO idx_spaces_user_id;
ALTER INDEX idx_scenes_project_id RENAME TO idx_scenes_space_id;

-- Rename the trigger
DROP TRIGGER IF EXISTS projects_updated_at ON public.spaces;
CREATE TRIGGER spaces_updated_at BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
