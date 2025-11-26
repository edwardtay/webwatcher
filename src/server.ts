import express from "express";

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

app.get("/", (_req, res) => {
  res
    .status(200)
    .send("WebWatcher / VeriSense agent server is running");
});

type UrlFeatures = {
  fullUrl: string;
  domain: string;
  path: string;
  isIp: boolean;
  hasAt: boolean;
  numDots: number;
  urlLength: number;
  keywordHits: string[];
  tld: string;
  tldSuspicious: boolean;
  brandImpersonation: string | null;
};

function urlFeatureAgent(rawUrl: string): UrlFeatures {
  let input = rawUrl.trim();
  if (!input.startsWith("http://") && !input.startsWith("https://")) {
    input = "https://" + input;
  }

  const parsed = new URL(input);
  const fullUrl = parsed.href;
  const domain = parsed.hostname;
  const path = parsed.pathname + parsed.search;

  const urlLower = fullUrl.toLowerCase();
  const domainLower = domain.toLowerCase();
  const pathLower = path.toLowerCase();

  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(domain);
  const hasAt = fullUrl.includes("@");
  const numDots = (domain.match(/\./g) || []).length;
  const urlLength = fullUrl.length;

  const suspiciousKeywords = [
    "login",
    "signin",
    "verify",
    "update",
    "secure",
    "account",
    "wallet",
    "password",
    "support"
  ];

  const keywordHits = suspiciousKeywords.filter(
    k => pathLower.includes(k) || domainLower.includes(k)
  );

  const weirdTlds = [".cn", ".ru", ".tk", ".ml", ".ga", ".gq", ".cf"];
  const tld = domainLower.slice(domainLower.lastIndexOf("."));
  const tldSuspicious = weirdTlds.includes(tld);

  const bigBrands = ["apple", "paypal", "google", "microsoft", "facebook", "binance"];
  let brandImpersonation: string | null = null;
  for (const b of bigBrands) {
    if (domainLower.includes(b) && !domainLower.endsWith(`${b}.com`)) {
      brandImpersonation = b;
      break;
    }
  }

  return {
    fullUrl,
    domain,
    path,
    isIp,
    hasAt,
    numDots,
    urlLength,
    keywordHits,
    tld,
    tldSuspicious,
    brandImpersonation
  };
}

function phishingRedFlagAgent(features: UrlFeatures) {
  const {
    fullUrl,
    domain,
    isIp,
    hasAt,
    numDots,
    urlLength,
    keywordHits,
    tld,
    tldSuspicious,
    brandImpersonation
  } = features;

  const redFlags: string[] = [];
  const notes: string[] = [];

  if (isIp) redFlags.push("Uses raw IP instead of normal domain name.");
  if (hasAt) redFlags.push("Contains @ which can hide the real destination.");
  if (numDots >= 3) redFlags.push("Many dots in domain, often used to hide real site.");
  if (urlLength > 80) redFlags.push("Very long URL, common in phishing links.");
  if (keywordHits.length > 0) {
    redFlags.push("Contains sensitive words: " + keywordHits.join(", "));
  }
  if (tldSuspicious) {
    redFlags.push(`Uses uncommon TLD: ${tld}.`);
  }
  if (brandImpersonation) {
    redFlags.push(
      `Domain contains brand name "${brandImpersonation}" but is not official ${brandImpersonation}.com.`
    );
  }

  if (!redFlags.length) {
    notes.push("No strong structural phishing signs in the URL alone.");
  }

  const verdict =
    redFlags.length >= 2
      ? "likely_phishing"
      : redFlags.length === 1
      ? "suspicious"
      : "no_strong_signals";

  const explanationLines: string[] = [];
  explanationLines.push(`Website checked: ${fullUrl}`);
  explanationLines.push(`Domain: ${domain}`);
  explanationLines.push("");

  if (redFlags.length) {
    explanationLines.push("Major red flags:");
    redFlags.forEach((f, i) => explanationLines.push(`${i + 1}. ${f}`));
  } else {
    explanationLines.push("No strong red flags detected from URL alone.");
  }

  if (notes.length) {
    explanationLines.push("");
    explanationLines.push("Notes:");
    notes.forEach((n, i) => explanationLines.push(`${i + 1}. ${n}`));
  }

  return {
    verdict,
    redFlags,
    explanation: explanationLines.join("\n")
  };
}

// A2A style endpoint: User -> UrlFeatureAgent -> PhishingRedFlagAgent
app.post("/check", (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "missing or invalid url" });
  }

  try {
    const features = urlFeatureAgent(url);
    const result = phishingRedFlagAgent(features);

    return res.json({
      url,
      features,
      verdict: result.verdict,
      redFlags: result.redFlags,
      explanation: result.explanation
    });
  } catch (e) {
    console.error("Error in /check:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

const agentCard = {
  id: "webwatcher-phish-checker",
  name: "WebWatcher Phishing URL Checker",
  description:
    "Cybersecurity agent that inspects a URL and reports phishing red flags using an internal A2A pipeline.",
  version: "1.0.0",
  author: {
    name: "NetWatch Team"
  },
  capabilities: {
    functions: [
      {
        name: "checkUrl",
        description: "Analyze a URL and return phishing red flags.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL to analyze for phishing indicators."
            }
          },
          required: ["url"]
        },
        outputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            verdict: { type: "string" },
            redFlags: { type: "array", items: { type: "string" } },
            explanation: { type: "string" }
          }
        }
      }
    ]
  },
  endpoints: {
    checkUrl: {
      method: "POST",
      path: "/check"
    }
  }
};

app.get("/.well-known/agent.json", (_req, res) => {
  res.json(agentCard);
});


app.listen(port, "0.0.0.0", () => {
  console.log(`[INFO] http server listening on port ${port}`);
});
