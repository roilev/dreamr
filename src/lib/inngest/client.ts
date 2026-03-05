import { EventSchemas, Inngest } from "inngest";

type DreamrEvents = {
  "dreamr/step.image360": {
    data: {
      sceneId: string;
      userId: string;
    };
  };
  "dreamr/step.video": {
    data: {
      sceneId: string;
      userId: string;
      veoModel?: "fal-ai/veo3.1" | "fal-ai/veo3/fast";
    };
  };
  "dreamr/step.upscale": {
    data: {
      sceneId: string;
      userId: string;
    };
  };
  "dreamr/step.depth": {
    data: {
      sceneId: string;
      userId: string;
      depthModel?: string;
      imageUrl?: string;
    };
  };
  "dreamr/world.generate": {
    data: {
      sceneId: string;
      userId: string;
      frameAssetId: string | null;
      imageUrl?: string;
    };
  };
};

export const inngest = new Inngest({
  id: "dreamr",
  schemas: new EventSchemas().fromRecord<DreamrEvents>(),
});
