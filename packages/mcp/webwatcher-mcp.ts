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

/**
 * whois_lookup
 */
server.registerTool(
  "whois_lookup",
  {
    title: "WHOIS domain lookup",
    description: "Get domain registration information including registrar, creation date, and expiry",
    inputSchema: {
      domain: z.string().describe("Domain name to lookup (e.g., example.com)"),
    },
    outputSchema: {
      domain: z.string(),
      registrar: z.string(),
      createdDate: z.string(),
      expiryDate: z.string(),
      ageInDays: z.number(),
      nameServers: z.array(z.string()),
      riskFlags: z.array(z.string()),
    },
  },
  async ({ domain }) => {
    try {
      // Use RDAP for WHOIS data
      const response = await fetch(`https://rdap.org/domain/${domain}`)
      if (!response.ok) {
        throw new Error(`RDAP lookup failed: ${response.status}`)
      }
      
      const data: any = await response.json()
      const events = data.events || []
      const createdEvent = events.find((e: any) => e.eventAction === 'registration')
      const expiryEvent = events.find((e: any) => e.eventAction === 'expiration')
      
      const createdDate = createdEvent?.eventDate || 'Unknown'
      const expiryDate = expiryEvent?.eventDate || 'Unknown'
      const ageInDays = createdDate !== 'Unknown' 
        ? Math.floor((Date.now() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24))
        : -1
      
      const nameServers = (data.nameservers || []).map((ns: any) => ns.ldhName || ns.name || 'Unknown')
      const registrar = data.entities?.[0]?.vcardArray?.[1]?.[1]?.[3] || 'Unknown'
      
      const riskFlags: string[] = []
      if (ageInDays >= 0 && ageInDays < 30) riskFlags.push('NEW_DOMAIN')
      if (ageInDays >= 0 && ageInDays < 7) riskFlags.push('VERY_NEW_DOMAIN')
      if (data.status?.includes('clientTransferProhibited')) riskFlags.push('TRANSFER_LOCKED')
      
      const output = {
        domain,
        registrar,
        createdDate,
        expiryDate,
        ageInDays,
        nameServers,
        riskFlags,
      }
      
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return {
        structuredContent: { domain, error: errorMsg },
        content: [{ type: "text", text: `WHOIS lookup failed: ${errorMsg}` }],
      }
    }
  },
)

/**
 * dns_lookup
 */
server.registerTool(
  "dns_lookup",
  {
    title: "DNS record lookup",
    description: "Query DNS records (A, AAAA, MX, TXT, NS, SOA) for a domain",
    inputSchema: {
      domain: z.string().describe("Domain name to query"),
      recordType: z.enum(['A', 'AAAA', 'MX', 'TXT', 'NS', 'SOA', 'CNAME']).default('A').describe("DNS record type"),
    },
    outputSchema: {
      domain: z.string(),
      recordType: z.string(),
      records: z.array(z.string()),
      ttl: z.number().optional(),
    },
  },
  async ({ domain, recordType }) => {
    try {
      const response = await fetch(`https://dns.google/resolve?name=${domain}&type=${recordType}`)
      if (!response.ok) {
        throw new Error(`DNS lookup failed: ${response.status}`)
      }
      
      const data: any = await response.json()
      const records = (data.Answer || []).map((ans: any) => ans.data || ans.name)
      const ttl = data.Answer?.[0]?.TTL
      
      const output = {
        domain,
        recordType,
        records,
        ttl,
      }
      
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return {
        structuredContent: { domain, recordType, error: errorMsg },
        content: [{ type: "text", text: `DNS lookup failed: ${errorMsg}` }],
      }
    }
  },
)

/**
 * ssl_certificate_info
 */
server.registerTool(
  "ssl_certificate_info",
  {
    title: "SSL certificate information",
    description: "Get SSL/TLS certificate details from certificate transparency logs",
    inputSchema: {
      domain: z.string().describe("Domain name to check certificates"),
    },
    outputSchema: {
      domain: z.string(),
      certificates: z.array(z.object({
        issuer: z.string(),
        notBefore: z.string(),
        notAfter: z.string(),
        serialNumber: z.string(),
      })),
      totalFound: z.number(),
    },
  },
  async ({ domain }) => {
    try {
      const response = await fetch(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`)
      if (!response.ok) {
        throw new Error(`Certificate lookup failed: ${response.status}`)
      }
      
      const data: any = await response.json()
      const certificates = (Array.isArray(data) ? data : []).slice(0, 10).map((cert: any) => ({
        issuer: cert.issuer_name || 'Unknown',
        notBefore: cert.not_before || 'Unknown',
        notAfter: cert.not_after || 'Unknown',
        serialNumber: cert.serial_number || 'Unknown',
      }))
      
      const output = {
        domain,
        certificates,
        totalFound: Array.isArray(data) ? data.length : 0,
      }
      
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return {
        structuredContent: { domain, error: errorMsg },
        content: [{ type: "text", text: `SSL certificate lookup failed: ${errorMsg}` }],
      }
    }
  },
)

/**
 * extract_urls_from_text
 */
server.registerTool(
  "extract_urls_from_text",
  {
    title: "Extract URLs from text",
    description: "Parse and extract all URLs from a given text (useful for email analysis)",
    inputSchema: {
      text: z.string().describe("Text content to extract URLs from"),
    },
    outputSchema: {
      urls: z.array(z.string()),
      domains: z.array(z.string()),
      count: z.number(),
    },
  },
  async ({ text }) => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
    const urls = text.match(urlRegex) || []
    
    const domains = urls.map(url => {
      try {
        return new URL(url).hostname
      } catch {
        return ''
      }
    }).filter(d => d)
    
    const uniqueDomains = [...new Set(domains)]
    
    const output = {
      urls,
      domains: uniqueDomains,
      count: urls.length,
    }
    
    return {
      structuredContent: output,
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    }
  },
)

/**
 * ip_geolocation
 */
server.registerTool(
  "ip_geolocation",
  {
    title: "IP geolocation and risk analysis",
    description: "Get geolocation, ISP, and risk indicators for an IP address",
    inputSchema: {
      ip: z.string().describe("IP address to analyze"),
    },
    outputSchema: {
      ip: z.string(),
      country: z.string(),
      city: z.string(),
      isp: z.string(),
      asn: z.string(),
      isProxy: z.boolean().optional(),
      isVpn: z.boolean().optional(),
      isHosting: z.boolean().optional(),
      riskFlags: z.array(z.string()),
    },
  },
  async ({ ip }) => {
    try {
      const response = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,message,country,city,isp,as,proxy,hosting,mobile`
      )
      
      if (!response.ok) {
        throw new Error(`IP lookup failed: ${response.status}`)
      }
      
      const data: any = await response.json()
      
      if (data.status === 'fail') {
        throw new Error(data.message || 'IP lookup failed')
      }
      
      const riskFlags: string[] = []
      if (data.proxy) riskFlags.push('PROXY_DETECTED')
      if (data.hosting) riskFlags.push('HOSTING_PROVIDER')
      if (data.mobile) riskFlags.push('MOBILE_NETWORK')
      
      const output = {
        ip,
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
        isp: data.isp || 'Unknown',
        asn: data.as || 'Unknown',
        isProxy: data.proxy || false,
        isVpn: data.proxy || false, // ip-api doesn't distinguish VPN from proxy
        isHosting: data.hosting || false,
        riskFlags,
      }
      
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return {
        structuredContent: { ip, error: errorMsg },
        content: [{ type: "text", text: `IP geolocation failed: ${errorMsg}` }],
      }
    }
  },
)

/**
 * check_phishing_database
 */
server.registerTool(
  "check_phishing_database",
  {
    title: "Check phishing databases",
    description: "Check if a URL is in known phishing databases (OpenPhish)",
    inputSchema: {
      url: z.string().describe("URL to check against phishing databases"),
    },
    outputSchema: {
      url: z.string(),
      isPhishing: z.boolean(),
      sources: z.array(z.string()),
      confidence: z.string(),
    },
  },
  async ({ url }) => {
    try {
      // Check OpenPhish feed
      const response = await fetch('https://openphish.com/feed.txt')
      if (!response.ok) {
        throw new Error('Failed to fetch OpenPhish feed')
      }
      
      const feed = await response.text()
      const phishingUrls = feed.split('\n').filter(line => line.trim())
      
      const urlLower = url.toLowerCase()
      const domain = new URL(url).hostname.toLowerCase()
      
      const isPhishing = phishingUrls.some(phishUrl => {
        const phishLower = phishUrl.toLowerCase()
        return phishLower === urlLower || phishLower.includes(domain)
      })
      
      const output = {
        url,
        isPhishing,
        sources: isPhishing ? ['OpenPhish'] : [],
        confidence: isPhishing ? 'HIGH' : 'UNKNOWN',
      }
      
      return {
        structuredContent: output,
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return {
        structuredContent: { url, error: errorMsg },
        content: [{ type: "text", text: `Phishing check failed: ${errorMsg}` }],
      }
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
