import { createClient } from "db-vendo-client";
import { profile as dbProfile } from "db-vendo-client/p/db/index.js";

export const client = createClient(dbProfile, "db-mcp-server");
