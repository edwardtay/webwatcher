/**
 * Advanced URL Security Analysis Service
 * Layer A: Deeper URL and page analysis
 */
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

export interface RedirectChain {
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  redirectType: 'http' | 'meta' | 'javascript' | 'none';
}

export interface RedirectAnalysis {
  chain: RedirectChain[];
  finalUrl: string;
  flags: string[];
  riskScore: number;
}

export interface PageContent {
  html: string;
  dom: {
    forms: number;
    scripts: number;
    iframes: number;
    externalLinks: number;
  };
  flags: string[];
  riskScore: number;
}

export interface FormRisk {
  formIndex: number;
  action: string;
  method: string;
  fields: Array<{
    name: string;
    type: string;
    suspicious: boolean;
  }>;
  flags: string[];
  riskScore: number;
}

export interface TLSAudit {
  certificate: {
    valid: boolean;
    issuer: string;
    validFrom: string;
    validTo: string;
    daysUntilExpiry: number;
    subjectAltNames?: string[];
    certificateCount?: number;
  };
  securityHeaders: {
    hsts: boolean;
    csp: boolean;
    xFrameOptions: boolean;
    xContentTypeOptions: boolean;
    referrerPolicy: boolean;
  };
  dnsRecords?: {
    a: string[];
    aaaa: string[];
    mx: string[];
    txt: string[];
    ns: string[];
  };
  flags: string[];
  riskScore: number;
}

/**
 * Analyze redirect chain - follows all redirects
 */
export async function analyzeRedirectChain(url: string): Promise<RedirectAnalysis> {
  const chain: RedirectChain[] = [];
  const flags: string[] = [];
  let currentUrl = url;
  let riskScore = 0;
  const maxRedirects = 10;
  const seenUrls = new Set<string>();

  try {
    for (let i = 0; i < maxRedirects; i++) {
      if (seenUrls.has(currentUrl)) {
        flags.push('redirect_loop_detected');
        riskScore += 30;
        break;
      }
      seenUrls.add(currentUrl);

      const response = await fetch(currentUrl, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      chain.push({
        url: currentUrl,
        statusCode: response.status,
        headers,
        redirectType: response.status >= 300 && response.status < 400 ? 'http' : 'none',
      });

      // Check for mixed HTTP/HTTPS
      if (currentUrl.startsWith('https://') && headers.location?.startsWith('http://')) {
        flags.push('https_to_http_downgrade');
        riskScore += 40;
      }

      // Check for IP-based redirect
      if (headers.location && /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(headers.location)) {
        flags.push('ip_based_redirect');
        riskScore += 25;
      }

      // Check for geo-based redirect (common headers)
      if (headers['x-geo-redirect'] || headers['cf-geo-redirect']) {
        flags.push('geo_based_redirect');
        riskScore += 10;
      }

      if (response.status >= 300 && response.status < 400 && headers.location) {
        currentUrl = new URL(headers.location, currentUrl).href;
      } else {
        // Check for meta refresh
        const html = await response.text();
        const metaRefresh = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'](\d+);url=([^"']+)["']/i);
        if (metaRefresh) {
          flags.push('meta_refresh_redirect');
          riskScore += 15;
          currentUrl = new URL(metaRefresh[2], currentUrl).href;
          chain.push({
            url: currentUrl,
            statusCode: 200,
            headers: {},
            redirectType: 'meta',
          });
        } else {
          break;
        }
      }
    }

    if (chain.length > 5) {
      flags.push('excessive_redirects');
      riskScore += 20;
    }

    return {
      chain,
      finalUrl: currentUrl,
      flags,
      riskScore: Math.min(riskScore, 100),
    };
  } catch (error) {
    logger.error('Error analyzing redirect chain:', error);
    throw error;
  }
}

/**
 * Scan page content for phishing patterns
 */
export async function scanPageContent(url: string): Promise<PageContent> {
  const flags: string[] = [];
  let riskScore = 0;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();

    // Count DOM elements
    const forms = (html.match(/<form/gi) || []).length;
    const scripts = (html.match(/<script/gi) || []).length;
    const iframes = (html.match(/<iframe/gi) || []).length;
    const externalLinks = (html.match(/href=["']https?:\/\//gi) || []).length;

    // Check for fake login forms
    if (html.match(/type=["']password["']/i) && html.match(/login|signin|log in/i)) {
      flags.push('login_form_detected');
      riskScore += 20;
    }

    // Check for brand impersonation
    const brands = ['paypal', 'apple', 'google', 'microsoft', 'facebook', 'amazon', 'binance', 'coinbase'];
    for (const brand of brands) {
      if (html.toLowerCase().includes(brand) && !url.toLowerCase().includes(brand)) {
        flags.push(`brand_impersonation_${brand}`);
        riskScore += 30;
      }
    }

    // Check for hidden inputs
    if (html.match(/<input[^>]*type=["']hidden["']/gi)) {
      const hiddenCount = (html.match(/<input[^>]*type=["']hidden["']/gi) || []).length;
      if (hiddenCount > 5) {
        flags.push('excessive_hidden_inputs');
        riskScore += 15;
      }
    }

    // Check for suspicious JavaScript
    if (html.match(/clipboard|keylog|keypress|keydown/i)) {
      flags.push('suspicious_javascript_clipboard_keylog');
      riskScore += 35;
    }

    // Check for obfuscated JavaScript
    if (html.match(/eval\(|atob\(|fromCharCode/i)) {
      flags.push('obfuscated_javascript');
      riskScore += 25;
    }

    // Check for excessive iframes
    if (iframes > 3) {
      flags.push('excessive_iframes');
      riskScore += 20;
    }

    return {
      html,
      dom: {
        forms,
        scripts,
        iframes,
        externalLinks,
      },
      flags,
      riskScore: Math.min(riskScore, 100),
    };
  } catch (error) {
    logger.error('Error scanning page content:', error);
    throw error;
  }
}

/**
 * Inspect forms for risk
 */
export async function inspectFormRisk(url: string): Promise<FormRisk[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const html = await response.text();
    const formMatches = html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/gi);
    const forms: FormRisk[] = [];

    let formIndex = 0;
    for (const formMatch of formMatches) {
      const formHtml = formMatch[0];
      const flags: string[] = [];
      let riskScore = 0;

      // Extract action
      const actionMatch = formHtml.match(/action=["']([^"']+)["']/i);
      const action = actionMatch ? actionMatch[1] : '';

      // Extract method
      const methodMatch = formHtml.match(/method=["']([^"']+)["']/i);
      const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';

      // Check if form posts to different domain
      if (action) {
        try {
          const actionUrl = new URL(action, url);
          const pageUrl = new URL(url);
          if (actionUrl.hostname !== pageUrl.hostname) {
            flags.push('cross_domain_form_submission');
            riskScore += 40;
          }
        } catch (e) {
          // Invalid URL
        }
      }

      // Extract fields
      const inputMatches = formHtml.matchAll(/<input[^>]*>/gi);
      const fields: Array<{ name: string; type: string; suspicious: boolean }> = [];

      for (const inputMatch of inputMatches) {
        const input = inputMatch[0];
        const nameMatch = input.match(/name=["']([^"']+)["']/i);
        const typeMatch = input.match(/type=["']([^"']+)["']/i);

        const name = nameMatch ? nameMatch[1] : '';
        const type = typeMatch ? typeMatch[1] : 'text';

        let suspicious = false;

        // Check for sensitive data collection
        if (type === 'password') {
          flags.push('password_field');
          riskScore += 15;
          suspicious = true;
        }

        if (name.match(/seed|phrase|private.*key|mnemonic|recovery/i)) {
          flags.push('seed_phrase_collection');
          riskScore += 50;
          suspicious = true;
        }

        if (name.match(/card|cvv|ccv|credit/i)) {
          flags.push('credit_card_collection');
          riskScore += 40;
          suspicious = true;
        }

        fields.push({ name, type, suspicious });
      }

      forms.push({
        formIndex,
        action,
        method,
        fields,
        flags,
        riskScore: Math.min(riskScore, 100),
      });

      formIndex++;
    }

    return forms;
  } catch (error) {
    logger.error('Error inspecting form risk:', error);
    throw error;
  }
}

/**
 * Query DNS records using DNS over HTTPS
 */
async function queryDNS(domain: string): Promise<any> {
  try {
    const dnsRecords: any = {
      a: [],
      aaaa: [],
      mx: [],
      txt: [],
      ns: [],
    };

    // Query different record types using Google DNS over HTTPS
    const recordTypes = ['A', 'AAAA', 'MX', 'TXT', 'NS'];
    
    for (const type of recordTypes) {
      try {
        const response = await fetch(`https://dns.google/resolve?name=${domain}&type=${type}`);
        const data: any = await response.json();
        
        if (data.Answer) {
          const key = type.toLowerCase();
          dnsRecords[key] = data.Answer.map((record: any) => record.data);
        }
      } catch (e) {
        logger.warn(`DNS ${type} lookup failed for ${domain}:`, e);
      }
    }

    return dnsRecords;
  } catch (error) {
    logger.warn('DNS query failed:', error);
    return null;
  }
}

/**
 * Check certificate transparency logs via crt.sh
 */
async function checkCertificateTransparency(domain: string): Promise<any> {
  try {
    // Query crt.sh for certificate transparency logs
    const response = await fetch(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`);
    
    if (!response.ok) {
      return null;
    }

    const certs: any[] = await response.json();
    
    if (!certs || certs.length === 0) {
      return null;
    }

    // Get unique issuers and count
    const issuers = [...new Set(certs.map(cert => cert.issuer_name))];
    const subjectAltNames = [...new Set(certs.flatMap(cert => 
      cert.name_value ? cert.name_value.split('\n') : []
    ))];

    // Get most recent certificate
    const sortedCerts = certs.sort((a, b) => 
      new Date(b.entry_timestamp).getTime() - new Date(a.entry_timestamp).getTime()
    );
    const latestCert = sortedCerts[0];

    return {
      certificateCount: certs.length,
      issuers: issuers.slice(0, 3), // Top 3 issuers
      latestIssuer: latestCert.issuer_name,
      notBefore: latestCert.not_before,
      notAfter: latestCert.not_after,
      subjectAltNames: subjectAltNames.slice(0, 10), // Top 10 SANs
    };
  } catch (error) {
    logger.warn('Certificate transparency check failed:', error);
    return null;
  }
}

/**
 * Audit TLS and security configuration
 */
export async function auditTLSAndConfig(url: string): Promise<TLSAudit> {
  const flags: string[] = [];
  let riskScore = 0;

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Fetch page and check headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    // Check security headers
    const securityHeaders = {
      hsts: response.headers.has('strict-transport-security'),
      csp: response.headers.has('content-security-policy'),
      xFrameOptions: response.headers.has('x-frame-options'),
      xContentTypeOptions: response.headers.has('x-content-type-options'),
      referrerPolicy: response.headers.has('referrer-policy'),
    };

    if (!securityHeaders.hsts && url.startsWith('https://')) {
      flags.push('missing_hsts');
      riskScore += 20;
    }

    if (!securityHeaders.csp) {
      flags.push('missing_csp');
      riskScore += 15;
    }

    if (!securityHeaders.xFrameOptions) {
      flags.push('missing_x_frame_options');
      riskScore += 15;
    }

    if (!securityHeaders.xContentTypeOptions) {
      flags.push('missing_x_content_type_options');
      riskScore += 10;
    }

    // Query DNS records
    const dnsRecords = await queryDNS(domain);

    // Check certificate transparency logs
    const certInfo = await checkCertificateTransparency(domain);

    let certificate: any = {
      valid: url.startsWith('https://'),
      issuer: 'Unknown',
      validFrom: 'Unknown',
      validTo: 'Unknown',
      daysUntilExpiry: -1,
    };

    if (certInfo) {
      certificate = {
        valid: true,
        issuer: certInfo.latestIssuer || 'Unknown',
        validFrom: certInfo.notBefore || 'Unknown',
        validTo: certInfo.notAfter || 'Unknown',
        daysUntilExpiry: certInfo.notAfter ? 
          Math.floor((new Date(certInfo.notAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : -1,
        subjectAltNames: certInfo.subjectAltNames,
        certificateCount: certInfo.certificateCount,
      };

      // Flag if certificate is expiring soon
      if (certificate.daysUntilExpiry >= 0 && certificate.daysUntilExpiry < 30) {
        flags.push('certificate_expiring_soon');
        riskScore += 25;
      }

      // Flag if too many certificates (possible domain abuse)
      if (certInfo.certificateCount > 50) {
        flags.push('excessive_certificates');
        riskScore += 15;
      }

      // Flag if certificate is very new (< 7 days)
      if (certInfo.notBefore) {
        const certAge = (Date.now() - new Date(certInfo.notBefore).getTime()) / (1000 * 60 * 60 * 24);
        if (certAge < 7) {
          flags.push('very_new_certificate');
          riskScore += 20;
        }
      }
    }

    if (!url.startsWith('https://')) {
      flags.push('no_tls_encryption');
      riskScore += 50;
    }

    return {
      certificate,
      securityHeaders,
      dnsRecords: dnsRecords || undefined,
      flags,
      riskScore: Math.min(riskScore, 100),
    };
  } catch (error) {
    logger.error('Error auditing TLS and config:', error);
    throw error;
  }
}
