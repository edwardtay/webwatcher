#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import * as z from "zod/v4"

const EXA_API_KEY = process.env.EXA_API_KEY as string
if (!EXA_API_KEY) {
  console.error("Missing EXA_API_KEY env var")
  process.exit(1)
}

type ExaSearchResult = {
  title: string
  url: string
  snippet?: string
}

async function exaSearch(
  query: string,
  numResults: number,
): Promise<ExaSearchResult[]> {
    const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": EXA_API_KEY,
        },
        body: JSON.stringify({
          query,
          numResults,
        }),
      })           

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Exa error ${res.status}: ${text}`)
  }

  const json: any = await res.json()

  return (json.results ?? []).map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.text ?? r.snippet ?? "",
  }))
}

// Create MCP server
const server = new McpServer({
  name: "exa-mcp",
  version: "0.1.0",
})

// Register Exa search tool
server.registerTool(
  "exa_search",
  {
    title: "Exa search",
    description: "Search the web using Exa and return structured results",
    inputSchema: {
      query: z.string().describe("User query text"),
      numResults: z.number().int().min(1).max(20).default(5),
    },
    outputSchema: {
      results: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          snippet: z.string().optional(),
        }),
      ),
    },
  },
  async ({ query, numResults }) => {
    const results = await exaSearch(query, numResults)
    const output = { results }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(output, null, 2),
        },
      ],
      structuredContent: output,
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error("Fatal MCP server error:", err)
  process.exit(1)
})
