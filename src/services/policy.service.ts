/**
 * Policy and Context Service
 * Layer C: User and policy context
 */
import { logger } from '../utils/logger';

export interface CategoryClassification {
  url: string;
  category: 'banking' | 'exchange' | 'productivity' | 'adult' | 'gambling' | 'social' | 'shopping' | 'unknown';
  confidence: number;
  subcategories: string[];
}

export interface PolicyCheck {
  url: string;
  policyProfileId: string;
  decision: 'allow' | 'warn' | 'block';
  explanation: string;
  matchedRules: string[];
  riskScore: number;
}

export interface RiskScoreWithExplanation {
  url: string;
  overallRiskScore: number;
  explanation: string;
  tags: string[];
  breakdown: {
    urlStructure: number;
    pageContent: number;
    reputation: number;
    threatIntel: number;
    tlsSecurity: number;
  };
  recommendation: 'safe' | 'caution' | 'danger';
}

/**
 * Classify URL category
 */
export async function classifyCategory(url: string): Promise<CategoryClassification> {
  try {
    const urlLower = url.toLowerCase();
    const domain = new URL(url).hostname.toLowerCase();

    // Banking keywords
    const bankingKeywords = ['bank', 'banking', 'chase', 'wellsfargo', 'bofa', 'citibank', 'hsbc'];
    if (bankingKeywords.some(k => domain.includes(k) || urlLower.includes(k))) {
      return {
        url,
        category: 'banking',
        confidence: 0.9,
        subcategories: ['financial', 'banking'],
      };
    }

    // Exchange keywords
    const exchangeKeywords = ['exchange', 'binance', 'coinbase', 'kraken', 'crypto', 'trading'];
    if (exchangeKeywords.some(k => domain.includes(k) || urlLower.includes(k))) {
      return {
        url,
        category: 'exchange',
        confidence: 0.85,
        subcategories: ['cryptocurrency', 'trading'],
      };
    }

    // Productivity keywords
    const productivityKeywords = ['google', 'microsoft', 'office', 'docs', 'drive', 'dropbox', 'slack'];
    if (productivityKeywords.some(k => domain.includes(k))) {
      return {
        url,
        category: 'productivity',
        confidence: 0.9,
        subcategories: ['workspace', 'collaboration'],
      };
    }

    // Adult keywords
    const adultKeywords = ['porn', 'xxx', 'adult', 'sex'];
    if (adultKeywords.some(k => domain.includes(k) || urlLower.includes(k))) {
      return {
        url,
        category: 'adult',
        confidence: 0.95,
        subcategories: ['adult_content'],
      };
    }

    // Gambling keywords
    const gamblingKeywords = ['casino', 'poker', 'betting', 'gamble'];
    if (gamblingKeywords.some(k => domain.includes(k) || urlLower.includes(k))) {
      return {
        url,
        category: 'gambling',
        confidence: 0.85,
        subcategories: ['gambling', 'betting'],
      };
    }

    // Social keywords
    const socialKeywords = ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok', 'reddit'];
    if (socialKeywords.some(k => domain.includes(k))) {
      return {
        url,
        category: 'social',
        confidence: 0.9,
        subcategories: ['social_media'],
      };
    }

    // Shopping keywords
    const shoppingKeywords = ['amazon', 'ebay', 'shop', 'store', 'buy'];
    if (shoppingKeywords.some(k => domain.includes(k) || urlLower.includes(k))) {
      return {
        url,
        category: 'shopping',
        confidence: 0.7,
        subcategories: ['ecommerce'],
      };
    }

    return {
      url,
      category: 'unknown',
      confidence: 0.5,
      subcategories: [],
    };
  } catch (error) {
    logger.error('Error classifying category:', error);
    throw error;
  }
}

/**
 * Check URL against policy profile
 */
export async function checkPolicy(url: string, policyProfileId: string): Promise<PolicyCheck> {
  try {
    const category = await classifyCategory(url);
    const matchedRules: string[] = [];
    let decision: 'allow' | 'warn' | 'block' = 'allow';
    let explanation = '';
    let riskScore = 0;

    // Load policy profile (in production, load from database)
    const policies: Record<string, any> = {
      enterprise: {
        blockCategories: ['adult', 'gambling'],
        warnCategories: ['social'],
        allowCategories: ['banking', 'exchange', 'productivity', 'shopping'],
      },
      strict: {
        blockCategories: ['adult', 'gambling', 'social'],
        warnCategories: ['shopping', 'unknown'],
        allowCategories: ['banking', 'productivity'],
      },
      permissive: {
        blockCategories: ['adult'],
        warnCategories: ['gambling'],
        allowCategories: ['banking', 'exchange', 'productivity', 'social', 'shopping', 'unknown'],
      },
    };

    const policy = policies[policyProfileId] || policies.permissive;

    // Check category against policy
    if (policy.blockCategories.includes(category.category)) {
      decision = 'block';
      matchedRules.push(`block_category_${category.category}`);
      explanation = `Blocked: ${category.category} sites are not allowed by policy`;
      riskScore = 100;
    } else if (policy.warnCategories.includes(category.category)) {
      decision = 'warn';
      matchedRules.push(`warn_category_${category.category}`);
      explanation = `Warning: ${category.category} sites require caution`;
      riskScore = 50;
    } else {
      decision = 'allow';
      matchedRules.push(`allow_category_${category.category}`);
      explanation = `Allowed: ${category.category} sites are permitted`;
      riskScore = 0;
    }

    // Additional checks
    const urlLower = url.toLowerCase();
    
    // Check for suspicious patterns
    if (urlLower.includes('login') || urlLower.includes('signin')) {
      matchedRules.push('contains_login_keyword');
      if (decision === 'allow') {
        decision = 'warn';
        explanation += '. Contains login-related keywords - verify authenticity';
        riskScore += 20;
      }
    }

    // Check for IP addresses
    if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) {
      matchedRules.push('ip_address_url');
      decision = 'warn';
      explanation += '. URL uses IP address instead of domain name';
      riskScore += 30;
    }

    return {
      url,
      policyProfileId,
      decision,
      explanation,
      matchedRules,
      riskScore: Math.min(riskScore, 100),
    };
  } catch (error) {
    logger.error('Error checking policy:', error);
    throw error;
  }
}

/**
 * Calculate comprehensive risk score with explanation
 */
export async function calculateRiskScore(
  url: string,
  analysisData: {
    urlStructure?: number;
    pageContent?: number;
    reputation?: number;
    threatIntel?: number;
    tlsSecurity?: number;
  }
): Promise<RiskScoreWithExplanation> {
  try {
    const breakdown = {
      urlStructure: analysisData.urlStructure || 0,
      pageContent: analysisData.pageContent || 0,
      reputation: analysisData.reputation || 0,
      threatIntel: analysisData.threatIntel || 0,
      tlsSecurity: analysisData.tlsSecurity || 0,
    };

    // Weighted average
    const weights = {
      urlStructure: 0.15,
      pageContent: 0.25,
      reputation: 0.25,
      threatIntel: 0.25,
      tlsSecurity: 0.10,
    };

    const overallRiskScore = Math.round(
      breakdown.urlStructure * weights.urlStructure +
      breakdown.pageContent * weights.pageContent +
      breakdown.reputation * weights.reputation +
      breakdown.threatIntel * weights.threatIntel +
      breakdown.tlsSecurity * weights.tlsSecurity
    );

    // Generate tags
    const tags: string[] = [];
    if (breakdown.urlStructure > 50) tags.push('suspicious_url_structure');
    if (breakdown.pageContent > 50) tags.push('suspicious_page_content');
    if (breakdown.reputation > 50) tags.push('poor_reputation');
    if (breakdown.threatIntel > 50) tags.push('threat_intel_flagged');
    if (breakdown.tlsSecurity > 50) tags.push('weak_security');

    // Determine recommendation
    let recommendation: 'safe' | 'caution' | 'danger';
    if (overallRiskScore < 30) {
      recommendation = 'safe';
    } else if (overallRiskScore < 70) {
      recommendation = 'caution';
    } else {
      recommendation = 'danger';
    }

    // Generate explanation
    let explanation = '';
    if (recommendation === 'safe') {
      explanation = 'This URL appears to be safe based on our analysis. No significant security concerns detected.';
    } else if (recommendation === 'caution') {
      explanation = 'This URL shows some suspicious characteristics. Proceed with caution and verify authenticity before entering sensitive information.';
      if (breakdown.pageContent > 50) {
        explanation += ' The page content contains suspicious patterns.';
      }
      if (breakdown.reputation > 50) {
        explanation += ' The domain has reputation issues.';
      }
    } else {
      explanation = 'This URL is highly suspicious and likely malicious. Do NOT enter passwords, seed phrases, or any sensitive information.';
      if (breakdown.threatIntel > 70) {
        explanation += ' Multiple threat intelligence sources have flagged this URL.';
      }
      if (breakdown.pageContent > 70) {
        explanation += ' The page contains clear phishing indicators.';
      }
    }

    return {
      url,
      overallRiskScore,
      explanation,
      tags,
      breakdown,
      recommendation,
    };
  } catch (error) {
    logger.error('Error calculating risk score:', error);
    throw error;
  }
}
