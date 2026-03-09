import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { instructions } from "./instructions.js";
import { registerFindStation } from "./tools/find-station.js";
import { registerGetDepartures } from "./tools/get-departures.js";
import { registerFindTrip } from "./tools/find-trip.js";
import { registerFindJourneys } from "./tools/find-journeys.js";

function createServer(): McpServer {
  const server = new McpServer(
    { name: "db-mcp", version: "1.0.0" },
    { instructions },
  );
  registerFindStation(server);
  registerGetDepartures(server);
  registerFindTrip(server);
  registerFindJourneys(server);
  return server;
}

if (process.env.PORT) {
  // Remote: Streamable HTTP transport
  const { createServer: createHttpServer } = await import("node:http");
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );

  const PORT = parseInt(process.env.PORT, 10);
  const sessions = new Map<
    string,
    { server: McpServer; transport: InstanceType<typeof StreamableHTTPServerTransport> }
  >();

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);

    // Health check for Railway
    if (url.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", name: "db-mcp" }));
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found. Use POST /mcp" }));
      return;
    }

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Parse body for POST
    let parsedBody: unknown = undefined;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      parsedBody = JSON.parse(Buffer.concat(chunks).toString());
    }

    // Route by session
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res, parsedBody);
      return;
    }

    if (sessionId && !sessions.has(sessionId)) {
      // Session expired or lost (e.g. after redeploy) — tell client to re-initialize
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found. Please start a new session." }));
      return;
    }

    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { server, transport });
        console.log(`Session created: ${id} (${sessions.size} active)`);
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) {
        sessions.delete(id);
        console.log(`Session closed: ${id} (${sessions.size} active)`);
      }
    };

    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  });

  httpServer.listen(PORT, () => {
    console.log(`DB-MCP Streamable HTTP server listening on port ${PORT}`);
    console.log(`Endpoint: http://localhost:${PORT}/mcp`);
  });
} else {
  // Local: stdio transport
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
