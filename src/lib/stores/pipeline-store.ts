import { create } from "zustand";
import type { PipelineStore } from "@/lib/types/stores";
import type { PipelineJobRow } from "@/lib/supabase/types";

export const usePipelineStore = create<PipelineStore>((set) => ({
  jobs: [],
  currentStep: null,
  isGenerating: false,

  setJobs: (jobs: PipelineJobRow[]) => {
    const running = jobs.find((j) => j.status === "running");
    set({
      jobs,
      currentStep: running?.step ?? null,
      isGenerating: jobs.some(
        (j) => j.status === "running" || j.status === "pending",
      ),
    });
  },

  updateJob: (job: PipelineJobRow) =>
    set((state) => {
      const jobs = state.jobs.map((j) => (j.id === job.id ? job : j));
      if (!jobs.find((j) => j.id === job.id)) {
        jobs.push(job);
      }
      const running = jobs.find((j) => j.status === "running");
      return {
        jobs,
        currentStep: running?.step ?? null,
        isGenerating: jobs.some(
          (j) => j.status === "running" || j.status === "pending",
        ),
      };
    }),

  addJob: (job: PipelineJobRow) =>
    set((state) => ({
      jobs: [...state.jobs, job],
      currentStep: job.status === "running" ? job.step : state.currentStep,
      isGenerating: true,
    })),

  reset: () => set({ jobs: [], currentStep: null, isGenerating: false }),
}));
