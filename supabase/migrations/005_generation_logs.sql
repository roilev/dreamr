CREATE TABLE IF NOT EXISTS public.generation_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id),
  scene_id uuid REFERENCES public.scenes(id) ON DELETE SET NULL,
  space_id uuid REFERENCES public.spaces(id) ON DELETE SET NULL,
  step text NOT NULL,
  provider text NOT NULL,
  model_id text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  cost_usd numeric(10,6) DEFAULT 0,
  duration_ms integer,
  input_metadata jsonb,
  output_metadata jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_generation_logs_user_id ON public.generation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_scene_id ON public.generation_logs(scene_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_space_id ON public.generation_logs(space_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_created_at ON public.generation_logs(created_at DESC);
