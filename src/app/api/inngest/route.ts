import { serve } from "inngest/next";
import { functions, inngest } from "@/modules/jobs";

export const { GET, POST, PUT } = serve({ client: inngest, functions });
