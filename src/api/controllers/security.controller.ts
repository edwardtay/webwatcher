/**
 * Security analysis controller
 */
import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import {
  analyzeRedirectChain,
  scanPageContent,
  inspectFormRisk,
  auditTLSAndConfig,
} from '../../services/url-security.service';
import {
  lookupReputation,
  checkWhoisAndAge,
  getIPRiskProfile,
  checkHaveIBeenPwned,
} from '../../services/threat-intel.service';
import {
  classifyCategory,
  checkPolicy,
  calculateRiskScore,
} from '../../services/policy.service';
import {
  generateIncidentReport,
  submitUserFeedback,
  getFeedbackStats,
  getRecentIncidents,
} from '../../services/incident.service';

export async function handleRedirectAnalysis(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const result = await analyzeRedirectChain(url);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Redirect analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze redirects', message: (error as Error).message });
  }
}

export async function handlePageContentScan(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const result = await scanPageContent(url);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Page content scan error:', error);
    res.status(500).json({ error: 'Failed to scan page content', message: (error as Error).message });
  }
}

export async function handleFormInspection(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const result = await inspectFormRisk(url);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Form inspection error:', error);
    res.status(500).json({ error: 'Failed to inspect forms', message: (error as Error).message });
  }
}

export async function handleTLSAudit(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const result = await auditTLSAndConfig(url);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('TLS audit error:', error);
    res.status(500).json({ error: 'Failed to audit TLS', message: (error as Error).message });
  }
}

export async function handleReputationLookup(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const result = await lookupReputation(url);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Reputation lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup reputation', message: (error as Error).message });
  }
}

export async function handleWhoisCheck(req: Request, res: Response) {
  try {
    const { domain } = req.body;
    const result = await checkWhoisAndAge(domain);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('WHOIS check error:', error);
    res.status(500).json({ error: 'Failed to check WHOIS', message: (error as Error).message });
  }
}

export async function handleIPRiskProfile(req: Request, res: Response) {
  try {
    const { ip } = req.body;
    const result = await getIPRiskProfile(ip);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('IP risk profile error:', error);
    res.status(500).json({ error: 'Failed to get IP risk profile', message: (error as Error).message });
  }
}

export async function handleBreachCheck(req: Request, res: Response) {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address required' });
    }
    
    const result = await checkHaveIBeenPwned(email);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Breach check error:', error);
    res.status(500).json({ error: 'Failed to check breaches', message: (error as Error).message });
  }
}

export async function handleCategoryClassification(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const result = await classifyCategory(url);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Category classification error:', error);
    res.status(500).json({ error: 'Failed to classify category', message: (error as Error).message });
  }
}

export async function handlePolicyCheck(req: Request, res: Response) {
  try {
    const { url, policyProfileId = 'permissive' } = req.body;
    const result = await checkPolicy(url, policyProfileId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Policy check error:', error);
    res.status(500).json({ error: 'Failed to check policy', message: (error as Error).message });
  }
}

export async function handleRiskScoreCalculation(req: Request, res: Response) {
  try {
    const { url, analysisData } = req.body;
    const result = await calculateRiskScore(url, analysisData || {});
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Risk score calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate risk score', message: (error as Error).message });
  }
}

export async function handleIncidentReportGeneration(req: Request, res: Response) {
  try {
    const { url, scanResults } = req.body;
    const result = await generateIncidentReport(url, scanResults || {});
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Incident report generation error:', error);
    res.status(500).json({ error: 'Failed to generate incident report', message: (error as Error).message });
  }
}

export async function handleFeedbackSubmission(req: Request, res: Response) {
  try {
    const { url, feedbackType, comment, incidentId, userId } = req.body;
    
    if (!['false_positive', 'confirmed_phish', 'benign_test', 'other'].includes(feedbackType)) {
      return res.status(400).json({ error: 'Invalid feedback type' });
    }
    
    const result = await submitUserFeedback(url, feedbackType, comment, incidentId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to submit feedback', message: (error as Error).message });
  }
}

export async function handleFeedbackStats(req: Request, res: Response) {
  try {
    const result = await getFeedbackStats();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Feedback stats error:', error);
    res.status(500).json({ error: 'Failed to get feedback stats', message: (error as Error).message });
  }
}

export async function handleRecentIncidents(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await getRecentIncidents(limit);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Recent incidents error:', error);
    res.status(500).json({ error: 'Failed to get recent incidents', message: (error as Error).message });
  }
}

/**
 * Comprehensive security scan - runs all checks
 */
export async function handleComprehensiveScan(req: Request, res: Response) {
  try {
    let { url, policyProfileId = 'permissive' } = req.body;
    
    // Normalize URL - add https:// if no protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    logger.info(`Starting comprehensive scan for: ${url}`);
    
    // Run all analyses in parallel
    const [
      redirectAnalysis,
      pageContent,
      formRisks,
      tlsAudit,
      reputation,
      category,
      policy,
    ] = await Promise.allSettled([
      analyzeRedirectChain(url),
      scanPageContent(url),
      inspectFormRisk(url),
      auditTLSAndConfig(url),
      lookupReputation(url),
      classifyCategory(url),
      checkPolicy(url, policyProfileId),
    ]);
    
    // Extract domain and IP for additional checks
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    const [whoisData, ipRisk] = await Promise.allSettled([
      checkWhoisAndAge(domain),
      (async () => {
        // Get IP from reputation check if available
        if (reputation.status === 'fulfilled' && reputation.value.ip !== 'Unknown') {
          return await getIPRiskProfile(reputation.value.ip);
        }
        return null;
      })(),
    ]);
    
    // Aggregate risk scores
    const analysisData = {
      urlStructure: redirectAnalysis.status === 'fulfilled' ? redirectAnalysis.value.riskScore : 0,
      pageContent: pageContent.status === 'fulfilled' ? pageContent.value.riskScore : 0,
      reputation: reputation.status === 'fulfilled' ? reputation.value.riskScore : 0,
      threatIntel: whoisData.status === 'fulfilled' ? whoisData.value.riskScore : 0,
      tlsSecurity: tlsAudit.status === 'fulfilled' ? tlsAudit.value.riskScore : 0,
    };
    
    const riskScore = await calculateRiskScore(url, analysisData);
    
    // Generate incident report
    const incidentReport = await generateIncidentReport(url, {
      urlStructure: redirectAnalysis.status === 'fulfilled' ? redirectAnalysis.value : undefined,
      pageContent: pageContent.status === 'fulfilled' ? pageContent.value : undefined,
      formRisk: formRisks.status === 'fulfilled' ? formRisks.value : undefined,
      tlsAudit: tlsAudit.status === 'fulfilled' ? tlsAudit.value : undefined,
      reputation: reputation.status === 'fulfilled' ? reputation.value : undefined,
      whois: whoisData.status === 'fulfilled' ? whoisData.value : undefined,
      ipRisk: ipRisk.status === 'fulfilled' ? ipRisk.value : undefined,
      riskScore,
    });
    
    res.json({
      success: true,
      data: {
        url,
        timestamp: new Date().toISOString(),
        riskScore,
        incidentReport,
        details: {
          redirectAnalysis: redirectAnalysis.status === 'fulfilled' ? redirectAnalysis.value : { error: 'Failed' },
          pageContent: pageContent.status === 'fulfilled' ? pageContent.value : { error: 'Failed' },
          formRisks: formRisks.status === 'fulfilled' ? formRisks.value : { error: 'Failed' },
          tlsAudit: tlsAudit.status === 'fulfilled' ? tlsAudit.value : { error: 'Failed' },
          reputation: reputation.status === 'fulfilled' ? reputation.value : { error: 'Failed' },
          whoisData: whoisData.status === 'fulfilled' ? whoisData.value : { error: 'Failed' },
          ipRisk: ipRisk.status === 'fulfilled' ? ipRisk.value : { error: 'Failed' },
          category: category.status === 'fulfilled' ? category.value : { error: 'Failed' },
          policy: policy.status === 'fulfilled' ? policy.value : { error: 'Failed' },
        },
      },
    });
  } catch (error) {
    logger.error('Comprehensive scan error:', error);
    res.status(500).json({ error: 'Failed to perform comprehensive scan', message: (error as Error).message });
  }
}
