import type { AppAPI } from "@/lib/contracts";
import { mockApi } from "@/lib/api.mock";

// Later you'll swap this to realApi (backend) without touching your UI.
export const api: AppAPI = mockApi;
