import { createClient } from "hafas-client";
import { profile as rmvProfile } from "hafas-client/p/rmv/index.js";

export const client = createClient(rmvProfile, "rmv-mcp-server");
