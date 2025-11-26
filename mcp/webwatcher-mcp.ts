#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import * as z from "zod/v4"

const EXA_API_KEY = process.env.EXA_API_KEY as string
if (!EXA_API_KEY) {
  console.error("Missing EXA_API_KEY")
  process.exit(1)
}

type ExaSearchResult = {
  title: string
  url: string
  snippet?: string
}

async function exaSearch(query: string, numResults: number): Promise<ExaSearchResult[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": EXA_API_KEY,
    },
    body: JSON.stringify({
      query,
      num_results: numResults,
      contents: { text: { max_characters: 500 } },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Exa error ${res.status}: ${text}`)
  }

  const json: any = await res.json()
  return (json.results ?? []).map((r: any) => ({
    title: String(r.title || ""),
    url: String(r.url || ""),
    snippet: String(r.text || r.snippet || ""),
  }))
}

const server = new McpServer({
  name: "webwatcher-agent",
  version: "0.1.0",
})

/**
 * search_cve
 */
server.registerTool(
  "search_cve",
  {
    title: "Search CVE entries",
    description: "Search CVE or vulnerability reports for a given query and optional year",
    inputSchema: {
      query: z.string().describe("Product, library, or CVE keyword"),
      year: z.string().optional().describe("Year like 2024 or 2025"),
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
  async ({ query, year, numResults }) => {
    const q = year ? `CVE ${year} ${query}` : `CVE ${query}`
    const results = await exaSearch(q, numResults)
    const output = { results }
    return {
      structuredContent: output,
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    }
  },
)

/**
 * analyze_transaction
 */
server.registerTool(
  "analyze_transaction",
  {
    title: "Analyze blockchain transaction",
    description: "Analyze a transaction for suspicious patterns",
    inputSchema: {
      chain: z.string().describe("Chain id or name, example ethereum, base"),
      txHash: z.string().describe("Transaction hash"),
    },
    outputSchema: {
      chain: z.string(),
      txHash: z.string(),
      riskScore: z.number().min(0).max(100),
      findings: z.array(z.string()),
      summary: z.string(),
    },
  },
  async ({ chain, txHash }) => {
    // Stub logic, plug in your real analysis here or call your existing API
    const findings: string[] = [
      "Heuristic analysis placeholder",
      "Connect this handler to your real risk engine",
    ]
    const output = {
      chain,
      txHash,
      riskScore: 42,
      findings,
      summary: `Transaction ${txHash} on ${chain} analyzed with placeholder logic. Replace with real rules or model.`,
    }
    return {
      structuredContent: output,
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    }
  },
)

/**
 * scan_wallet_risks
 */
server.registerTool(
  "scan_wallet_risks",
  {
    title: "Scan wallet for risks",
    description: "Check an address for obvious risk factors and anomalies",
    inputSchema: {
      chain: z.string().describe("Chain id or name"),
      address: z.string().describe("Wallet or contract address"),
    },
    outputSchema: {
      chain: z.string(),
      address: z.string(),
      riskScore: z.number().min(0).max(100),
      tags: z.array(z.string()),
      alerts: z.array(z.string()),
      summary: z.string(),
    },
  },
  async ({ chain, address }) => {
    // Stub: replace with your onchain intel, Exa search, or third party feeds
    const tags: string[] = ["new_wallet", "no_known_sanctions_hits"]
    const alerts: string[] = ["Connect to your threat intel feed here"]
    const output = {
      chain,
      address,
      riskScore: 30,
      tags,
      alerts,
      summary: `Basic risk scan for ${address} on ${chain}. Replace with real signals from explorers or intel APIs.`,
    }
    return {
      structuredContent: output,
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    }
  },
)

/**
 * summarize_security_state
 */
server.registerTool(
  "summarize_security_state",
  {
    title: "Summarize security state",
    description: "Summarize overall security posture for a given address or project",
    inputSchema: {
      subject: z.string().describe("Wallet address, contract, domain, or project name"),
      context: z.string().optional().describe("Extra context like chain, protocol, or use case"),
    },
    outputSchema: {
      subject: z.string(),
      context: z.string().optional(),
      summary: z.string(),
      recommendations: z.array(z.string()),
    },
  },
  async ({ subject, context }) => {
    // You can also call exaSearch here for extra intel
    const recs: string[] = [
      "Set up continuous monitoring for new CVEs and exploitable patterns",
      "Rotate keys and limit hot wallet exposure",
      "Use allowlist based approvals for high value flows",
    ]
    const output = {
      subject,
      context,
      summary: `High level security summary for ${subject}${context ? ` in context ${context}` : ""}. Replace this text with your model generated or rules based summary.`,
      recommendations: recs,
    }
    return {
      structuredContent: output,
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error("Fatal MCP server error", err)
  process.exit(1)
})
