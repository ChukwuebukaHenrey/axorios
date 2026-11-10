import { serve } from "inngest/next";
import { functions, inngest } from "@/modules/jobs";

// A sales-agent turn can take tens of seconds when the model is slow; 60 s cut turns off mid-reply and forced a retry.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
