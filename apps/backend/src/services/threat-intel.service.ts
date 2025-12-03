/**
 * Threat Intelligence Service
 * Layer B: Threat intelligence and reputation
 */
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

export interface ReputationCheck {
  url: string;
  domain: string;
  ip: string;
  flags: string[];
  sources: Array<{
    name: string;
    status: 'clean' | 'suspicious' | 'malicious' | 'unknown';
    details?: string;
  }>;
  riskScore: number;
}

export interface WhoisData {
  domain: string;
  registrar: string;
  createdDate: string;
  updatedDate: string;
  expiryDate: string;
  ageInDays: number;
  registrant: string;
  flags: string[];
  riskScore: number;
}

export interface IPRiskProfile {
  ip: string;
  country: string;
  city: string;
  asn: string;
  asnOrg: string;
  hostingProvider: string;
  isProxy?: boolean;
  isVpn?: boolean;
  isTor?: boolean;
  isHosting?: boolean;
  abuseScore?: number;
  totalReports?: number;
  flags: string[];
  riskScore: number;
}

/**
 * Check against OpenPhish database
 */
async function checkOpenPhish(url: string): Promise<boolean> {
  try {
    // OpenPhish provides a free feed of phishing URLs
    const response = await fetch('https://openphish.com/feed.txt');
    if (!response.ok) return false;
    
    const feed = await response.text();
    const phishingUrls = feed.split('\n').filter(line => line.trim());
    
    // Check if URL or domain is in the feed
    const urlToCheck = url.toLowerCase();
    const domain = new URL(url).hostname.toLowerCase();
    
    return phishingUrls.some(phishUrl => {
      const phishLower = phishUrl.toLowerCase();
      return phishLower === urlToCheck || phishLower.includes(domain);
    });
  } catch (error) {
    logger.warn('OpenPhish check failed:', error);
    return false;
  }
}

/**
 * Check URL/domain/IP reputation against threat intel feeds
 */
export async function lookupReputation(url: string): Promise<ReputationCheck> {
  const flags: string[] = [];
  let riskScore = 0;
  const sources: Array<{
    name: string;
    status: 'clean' | 'suspicious' | 'malicious' | 'unknown';
    details?: string;
  }> = [];

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // Resolve IP (simplified - in production use DNS lookup)
    let ip = 'Unknown';
    try {
      const dnsResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
      const dnsData: any = await dnsResponse.json();
      if (dnsData.Answer && dnsData.Answer.length > 0) {
        ip = dnsData.Answer[0].data;
      }
    } catch (e) {
      logger.warn('DNS lookup failed:', e);
    }

    // Check against OpenPhish (free, no API key required)
    const isOpenPhish = await checkOpenPhish(url);
    if (isOpenPhish) {
      sources.push({
        name: 'OpenPhish',
        status: 'malicious',
        details: 'URL found in OpenPhish phishing database',
      });
      flags.push('openphish_phishing');
      riskScore += 90; // Very high confidence
    } else {
      sources.push({
        name: 'OpenPhish',
        status: 'clean',
      });
    }

    // Check against Google Safe Browsing (requires API key)
    if (process.env.GOOGLE_SAFE_BROWSING_API_KEY) {
      try {
        const gsbResponse = await fetch(
          `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_SAFE_BROWSING_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client: {
                clientId: 'webwatcher',
                clientVersion: '1.0.0',
              },
              threatInfo: {
                threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
                platformTypes: ['ANY_PLATFORM'],
                threatEntryTypes: ['URL'],
                threatEntries: [{ url }],
              },
            }),
          }
        );
        const gsbData: any = await gsbResponse.json();
        if (gsbData.matches && gsbData.matches.length > 0) {
          sources.push({
            name: 'Google Safe Browsing',
            status: 'malicious',
            details: gsbData.matches[0].threatType,
          });
          flags.push('google_safe_browsing_malicious');
          riskScore += 80;
        } else {
          sources.push({
            name: 'Google Safe Browsing',
            status: 'clean',
          });
        }
      } catch (e) {
        logger.warn('Google Safe Browsing check failed:', e);
      }
    }

    // Check against VirusTotal (requires API key)
    if (process.env.VIRUSTOTAL_API_KEY) {
      try {
        const vtResponse = await fetch(
          `https://www.virustotal.com/api/v3/urls/${Buffer.from(url).toString('base64').replace(/=/g, '')}`,
          {
            headers: {
              'x-apikey': process.env.VIRUSTOTAL_API_KEY,
            },
          }
        );
        if (vtResponse.ok) {
          const vtData: any = await vtResponse.json();
          const malicious = vtData.data?.attributes?.last_analysis_stats?.malicious || 0;
          if (malicious > 0) {
            sources.push({
              name: 'VirusTotal',
              status: 'malicious',
              details: `${malicious} engines flagged as malicious`,
            });
            flags.push('virustotal_malicious');
            riskScore += 70;
          } else {
            sources.push({
              name: 'VirusTotal',
              status: 'clean',
            });
          }
        }
      } catch (e) {
        logger.warn('VirusTotal check failed:', e);
      }
    }

    // Check for newly registered domain (heuristic)
    const tld = domain.split('.').pop();
    const suspiciousTlds = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'work'];
    if (suspiciousTlds.includes(tld || '')) {
      flags.push('suspicious_tld');
      riskScore += 20;
    }

    // Check for bulletproof hosting ASNs (common malicious hosting)
    const bulletproofASNs = ['AS197695', 'AS200019', 'AS208091'];
    // This would require actual ASN lookup in production

    return {
      url,
      domain,
      ip,
      flags,
      sources,
      riskScore: Math.min(riskScore, 100),
    };
  } catch (error) {
    logger.error('Error checking reputation:', error);
    throw error;
  }
}

/**
 * Check WHOIS data and domain age
 */
export async function checkWhoisAndAge(domain: string): Promise<WhoisData> {
  const flags: string[] = [];
  let riskScore = 0;

  try {
    let whoisData: any = {};
    let createdDate = 'Unknown';
    let updatedDate = 'Unknown';
    let expiryDate = 'Unknown';
    let registrar = 'Unknown';
    let registrant = 'Unknown';

    // Use RDAP for WHOIS data (free)
    if (createdDate === 'Unknown') {
      try {
        logger.info('Using RDAP for WHOIS data');
        const rdapResponse = await fetch(`https://rdap.org/domain/${domain}`);
        if (rdapResponse.ok) {
          whoisData = await rdapResponse.json();
          
          createdDate = whoisData.events?.find((e: any) => e.eventAction === 'registration')?.eventDate || 'Unknown';
          updatedDate = whoisData.events?.find((e: any) => e.eventAction === 'last changed')?.eventDate || 'Unknown';
          expiryDate = whoisData.events?.find((e: any) => e.eventAction === 'expiration')?.eventDate || 'Unknown';
          registrar = whoisData.entities?.find((e: any) => e.roles?.includes('registrar'))?.vcardArray?.[1]?.[1]?.[3] || 'Unknown';
          registrant = whoisData.entities?.find((e: any) => e.roles?.includes('registrant'))?.vcardArray?.[1]?.[1]?.[3] || 'Unknown';
        }
      } catch (e) {
        logger.warn('RDAP lookup failed:', e);
      }
    }

    // Calculate domain age
    let ageInDays = -1;
    if (createdDate !== 'Unknown') {
      const created = new Date(createdDate);
      const now = new Date();
      ageInDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

      // Flag newly registered domains (high risk for phishing)
      if (ageInDays < 30) {
        flags.push('newly_registered_domain');
        riskScore += 40;
      } else if (ageInDays < 90) {
        flags.push('recently_registered_domain');
        riskScore += 20;
      } else if (ageInDays < 365) {
        flags.push('domain_less_than_1_year');
        riskScore += 10;
      }
    }

    // Check for privacy protection (common in phishing)
    if (registrant.toLowerCase().includes('privacy') || 
        registrant.toLowerCase().includes('redacted') ||
        registrant.toLowerCase().includes('protected')) {
      flags.push('privacy_protected_registrant');
      riskScore += 15;
    }

    // Check for suspicious registrars
    const suspiciousRegistrars = ['namecheap', 'godaddy', 'tucows'];
    if (suspiciousRegistrars.some(sr => registrar.toLowerCase().includes(sr))) {
      flags.push('common_phishing_registrar');
      riskScore += 10;
    }

    return {
      domain,
      registrar,
      createdDate,
      updatedDate,
      expiryDate,
      ageInDays,
      registrant,
      flags,
      riskScore: Math.min(riskScore, 100),
    };
  } catch (error) {
    logger.error('Error checking WHOIS:', error);
    throw error;
  }
}

/**
 * Check email against HaveIBeenPwned breach database
 */
export interface BreachData {
  email: string;
  breaches: Array<{
    name: string;
    title: string;
    domain: string;
    breachDate: string;
    addedDate: string;
    pwnCount: number;
    description: string;
    dataClasses: string[];
    isVerified: boolean;
    isFabricated: boolean;
    isSensitive: boolean;
    isRetired: boolean;
  }>;
  totalBreaches: number;
  totalPwnCount: number;
  riskScore: number;
  flags: string[];
}

export async function checkHaveIBeenPwned(email: string): Promise<BreachData> {
  const flags: string[] = [];
  let riskScore = 0;

  try {
    if (!process.env.HIBP_API_KEY) {
      throw new Error('HIBP_API_KEY not configured');
    }

    // HaveIBeenPwned API v3 requires API key in header
    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': process.env.HIBP_API_KEY,
          'user-agent': 'WebWatcher-Security-Platform',
        },
      }
    );

    if (response.status === 404) {
      // No breaches found - good news!
      return {
        email,
        breaches: [],
        totalBreaches: 0,
        totalPwnCount: 0,
        riskScore: 0,
        flags: ['no_breaches_found'],
      };
    }

    if (!response.ok) {
      throw new Error(`HIBP API error: ${response.status} ${response.statusText}`);
    }

    const breaches = (await response.json()) as any[];
    
    // Calculate risk score based on breaches
    const totalBreaches = breaches.length;
    const totalPwnCount = breaches.reduce((sum, b) => sum + (b.PwnCount || 0), 0);

    // Risk scoring
    if (totalBreaches > 10) {
      flags.push('high_breach_count');
      riskScore += 60;
    } else if (totalBreaches > 5) {
      flags.push('moderate_breach_count');
      riskScore += 40;
    } else if (totalBreaches > 0) {
      flags.push('low_breach_count');
      riskScore += 20;
    }

    // Check for recent breaches (within last year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const recentBreaches = breaches.filter(b => {
      const breachDate = new Date(b.BreachDate);
      return breachDate > oneYearAgo;
    });

    if (recentBreaches.length > 0) {
      flags.push('recent_breaches');
      riskScore += 30;
    }

    // Check for sensitive breaches
    const sensitiveBreaches = breaches.filter(b => b.IsSensitive);
    if (sensitiveBreaches.length > 0) {
      flags.push('sensitive_data_exposed');
      riskScore += 25;
    }

    // Format breach data
    const formattedBreaches = breaches.map(b => ({
      name: b.Name,
      title: b.Title,
      domain: b.Domain,
      breachDate: b.BreachDate,
      addedDate: b.AddedDate,
      pwnCount: b.PwnCount,
      description: b.Description,
      dataClasses: b.DataClasses || [],
      isVerified: b.IsVerified,
      isFabricated: b.IsFabricated,
      isSensitive: b.IsSensitive,
      isRetired: b.IsRetired,
    }));

    return {
      email,
      breaches: formattedBreaches,
      totalBreaches,
      totalPwnCount,
      riskScore: Math.min(riskScore, 100),
      flags,
    };
  } catch (error) {
    logger.error('Error checking HaveIBeenPwned:', error);
    throw error;
  }
}

/**
 * Get IP risk profile (geo, hosting, ASN, abuse, proxy/VPN detection)
 */
export async function getIPRiskProfile(ip: string): Promise<IPRiskProfile> {
  const flags: string[] = [];
  let riskScore = 0;

  try {
    // Use ip-api.com for geo lookup (free, no key required)
    // Includes proxy/VPN/hosting detection in pro fields
    const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`);
    const geoData: any = await geoResponse.json();

    if (geoData.status === 'fail') {
      throw new Error(geoData.message || 'IP lookup failed');
    }

    const country = geoData.country || 'Unknown';
    const city = geoData.city || 'Unknown';
    const asn = geoData.as?.split(' ')[0] || 'Unknown';
    const asnOrg = geoData.as?.substring(geoData.as.indexOf(' ') + 1) || 'Unknown';
    const hostingProvider = geoData.isp || 'Unknown';
    
    // Proxy/VPN/Hosting detection from ip-api.com
    const isProxy = geoData.proxy || false;
    const isHosting = geoData.hosting || false;
    const isMobile = geoData.mobile || false;

    // Check for high-risk countries (common for phishing)
    const highRiskCountries = ['Russia', 'China', 'Nigeria', 'Ukraine', 'North Korea', 'Iran'];
    if (highRiskCountries.includes(country)) {
      flags.push('high_risk_country');
      riskScore += 25;
    }

    // Check for proxy/VPN
    if (isProxy) {
      flags.push('proxy_or_vpn_detected');
      riskScore += 40;
    }

    // Check for hosting/datacenter IP
    if (isHosting) {
      flags.push('datacenter_ip');
      riskScore += 30;
    }

    // Check for bulletproof hosting
    const bulletproofKeywords = ['bulletproof', 'offshore', 'anonymous', 'privacy'];
    if (bulletproofKeywords.some(keyword => asnOrg.toLowerCase().includes(keyword))) {
      flags.push('bulletproof_hosting');
      riskScore += 50;
    }

    // Check for VPS/cloud hosting (common for phishing)
    const cloudProviders = ['amazon', 'google', 'microsoft', 'digitalocean', 'vultr', 'linode', 'ovh', 'hetzner'];
    if (cloudProviders.some(provider => asnOrg.toLowerCase().includes(provider))) {
      flags.push('cloud_hosting');
      riskScore += 15;
    }

    // Check AbuseIPDB if API key is available
    let abuseScore = 0;
    let totalReports = 0;
    
    if (process.env.ABUSEIPDB_API_KEY) {
      try {
        logger.info('Checking AbuseIPDB for IP abuse reports');
        const abuseResponse = await fetch(
          `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose`,
          {
            headers: {
              'Key': process.env.ABUSEIPDB_API_KEY,
              'Accept': 'application/json',
            },
          }
        );

        if (abuseResponse.ok) {
          const abuseData: any = await abuseResponse.json();
          const data = abuseData.data;
          
          abuseScore = data.abuseConfidenceScore || 0;
          totalReports = data.totalReports || 0;

          // High abuse score
          if (abuseScore > 75) {
            flags.push('high_abuse_score');
            riskScore += 60;
          } else if (abuseScore > 50) {
            flags.push('moderate_abuse_score');
            riskScore += 40;
          } else if (abuseScore > 25) {
            flags.push('low_abuse_score');
            riskScore += 20;
          }

          // Many reports
          if (totalReports > 50) {
            flags.push('many_abuse_reports');
            riskScore += 30;
          } else if (totalReports > 10) {
            flags.push('some_abuse_reports');
            riskScore += 15;
          }

          // Check if it's a known TOR exit node
          if (data.usageType === 'Data Center/Web Hosting/Transit' && data.isTor) {
            flags.push('tor_exit_node');
            riskScore += 45;
          }

          logger.info(`AbuseIPDB check complete: score=${abuseScore}, reports=${totalReports}`);
        }
      } catch (e) {
        logger.warn('AbuseIPDB check failed:', e);
      }
    }

    return {
      ip,
      country,
      city,
      asn,
      asnOrg,
      hostingProvider,
      isProxy,
      isVpn: isProxy, // ip-api.com doesn't distinguish, but proxy often means VPN
      isTor: flags.includes('tor_exit_node'),
      isHosting,
      abuseScore: abuseScore > 0 ? abuseScore : undefined,
      totalReports: totalReports > 0 ? totalReports : undefined,
      flags,
      riskScore: Math.min(riskScore, 100),
    };
  } catch (error) {
    logger.error('Error getting IP risk profile:', error);
    throw error;
  }
}
