import type { MarbleOperation } from "./types";

const MARBLE_API_URL = process.env.MARBLE_API_URL ?? "https://api.worldlabs.ai";
const MARBLE_API_KEY = process.env.MARBLE_API_KEY!;

async function marbleRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${MARBLE_API_URL}${path}`, {
    ...options,
    headers: {
      "WLT-Api-Key": MARBLE_API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Marble API error ${res.status}: ${error.message ?? error.detail ?? res.statusText}`);
  }

  return res.json();
}

export async function generateWorld(
  imageUrl: string,
  textPrompt?: string,
  options: { isPano?: boolean; model?: string } = {},
): Promise<{ operationId: string }> {
  const body = {
    world_prompt: {
      type: "image",
      image_prompt: {
        source: "uri",
        uri: imageUrl,
      },
      is_pano: options.isPano ?? true,
      ...(textPrompt && { text_prompt: textPrompt }),
    },
    model: options.model ?? "Marble 0.1-plus",
  };

  const result = await marbleRequest<{ operation_id: string }>(
    "/marble/v1/worlds:generate",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return { operationId: result.operation_id };
}

export async function getOperation(
  operationId: string,
): Promise<MarbleOperation> {
  return marbleRequest<MarbleOperation>(`/marble/v1/operations/${operationId}`);
}

export async function waitForWorld(
  operationId: string,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    onProgress?: (status: string) => void;
  } = {},
): Promise<MarbleOperation> {
  const maxAttempts = options.maxAttempts ?? 60;
  const initialDelay = options.initialDelayMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const op = await getOperation(operationId);
    options.onProgress?.(op.status);

    if (op.status === "SUCCEEDED") return op;
    if (op.status === "FAILED")
      throw new Error(op.error?.message ?? "World generation failed");

    const delay = Math.min(initialDelay * Math.pow(1.5, i), 15000);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error("World generation timed out");
}
