import { ImageResponse } from "next/og";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const alt = "Dreamr Scene";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const supabase = createAdminSupabase();

  const { data: scene } = await supabase
    .from("scenes")
    .select("name, prompt, thumbnail_url")
    .eq("share_token", shareId)
    .single();

  const name = (scene as { name?: string } | null)?.name || "Dreamr World";
  const prompt = (scene as { prompt?: string | null } | null)?.prompt;
  const thumbnailUrl = (scene as { thumbnail_url?: string | null } | null)
    ?.thumbnail_url;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a14 0%, #1a1a2e 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "60px",
        }}
      >
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            width={400}
            height={300}
            style={{
              objectFit: "cover",
              borderRadius: 16,
              marginBottom: 30,
            }}
          />
        )}
        <div
          style={{
            color: "white",
            fontSize: 48,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          {name}
        </div>
        {prompt && (
          <div
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 24,
              marginTop: 16,
              textAlign: "center",
              maxWidth: 800,
            }}
          >
            {prompt.length > 120 ? `${prompt.slice(0, 120)}...` : prompt}
          </div>
        )}
        <div
          style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 18,
            marginTop: 40,
          }}
        >
          dreamr.ai
        </div>
      </div>
    ),
    { ...size },
  );
}
