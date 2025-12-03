/**
 * URL analysis service - phishing detection
 */
import { UrlFeatures, PhishingAnalysisResult } from '../types';

export function extractUrlFeatures(rawUrl: string): UrlFeatures {
  let input = rawUrl.trim();
  if (!input.startsWith('http://') && !input.startsWith('https://')) {
    input = 'https://' + input;
  }

  const parsed = new URL(input);
  const fullUrl = parsed.href;
  const domain = parsed.hostname;
  const path = parsed.pathname + parsed.search;

  const urlLower = fullUrl.toLowerCase();
  const domainLower = domain.toLowerCase();
  const pathLower = path.toLowerCase();

  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(domain);
  const hasAt = fullUrl.includes('@');
  const numDots = (domain.match(/\./g) || []).length;
  const urlLength = fullUrl.length;

  const suspiciousKeywords = [
    'login', 'signin', 'verify', 'update', 'secure',
    'account', 'wallet', 'password', 'support',
  ];

  const keywordHits = suspiciousKeywords.filter(
    (k) => pathLower.includes(k) || domainLower.includes(k)
  );

  const weirdTlds = ['.cn', '.ru', '.tk', '.ml', '.ga', '.gq', '.cf'];
  const tld = domainLower.slice(domainLower.lastIndexOf('.'));
  const tldSuspicious = weirdTlds.includes(tld);

  const bigBrands = ['apple', 'paypal', 'google', 'microsoft', 'facebook', 'binance'];
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
    brandImpersonation,
  };
}

export function analyzePhishingRedFlags(features: UrlFeatures): PhishingAnalysisResult {
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
    brandImpersonation,
  } = features;

  const redFlags: string[] = [];
  const notes: string[] = [];

  if (isIp) redFlags.push('Uses raw IP instead of normal domain name.');
  if (hasAt) redFlags.push('Contains @ which can hide the real destination.');
  if (numDots >= 3) redFlags.push('Many dots in domain, often used to hide real site.');
  if (urlLength > 80) redFlags.push('Very long URL, common in phishing links.');
  if (keywordHits.length > 0) {
    redFlags.push('Contains sensitive words: ' + keywordHits.join(', '));
  }
  if (tldSuspicious) redFlags.push(`Uses uncommon TLD: ${tld}.`);
  if (brandImpersonation) {
    redFlags.push(
      `Domain contains brand name "${brandImpersonation}" but is not official ${brandImpersonation}.com.`
    );
  }

  if (!redFlags.length) {
    notes.push('No strong structural phishing signs in the URL alone.');
  }

  const verdict =
    redFlags.length >= 2
      ? 'likely_phishing'
      : redFlags.length === 1
      ? 'suspicious'
      : 'no_strong_signals';

  const explanationLines: string[] = [];
  explanationLines.push(`Website checked: ${fullUrl}`);
  explanationLines.push(`Domain: ${domain}`);
  explanationLines.push('');

  if (redFlags.length) {
    explanationLines.push('Major red flags:');
    redFlags.forEach((f, i) => explanationLines.push(`${i + 1}. ${f}`));
  } else {
    explanationLines.push('No strong red flags detected from URL alone.');
  }

  if (notes.length) {
    explanationLines.push('');
    explanationLines.push('Notes:');
    notes.forEach((n, i) => explanationLines.push(`${i + 1}. ${n}`));
  }

  return {
    verdict,
    redFlags,
    explanation: explanationLines.join('\n'),
  };
}
