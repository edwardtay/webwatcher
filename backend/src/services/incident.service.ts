/**
 * Incident and Feedback Service
 * Layer D: Incident reporting and feedback loop
 */
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface IncidentReport {
  id: string;
  timestamp: string;
  url: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  findings: Array<{
    type: string;
    description: string;
    riskScore: number;
  }>;
  overallRiskScore: number;
  recommendation: string;
  metadata: {
    userAgent?: string;
    sourceIP?: string;
    userId?: string;
  };
  siemReady: boolean;
}

export interface UserFeedback {
  id: string;
  timestamp: string;
  url: string;
  incidentId?: string;
  feedbackType: 'false_positive' | 'confirmed_phish' | 'benign_test' | 'other';
  comment?: string;
  userId?: string;
}

export interface FeedbackStats {
  total: number;
  falsePositives: number;
  confirmedPhish: number;
  benignTests: number;
  other: number;
}

/**
 * Generate structured incident report
 */
export async function generateIncidentReport(
  url: string,
  scanResults: {
    urlStructure?: any;
    pageContent?: any;
    formRisk?: any[];
    tlsAudit?: any;
    reputation?: any;
    whois?: any;
    ipRisk?: any;
    riskScore?: any;
  }
): Promise<IncidentReport> {
  try {
    const id = `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    const findings: Array<{ type: string; description: string; riskScore: number }> = [];

    // Aggregate findings from all scan results
    if (scanResults.urlStructure) {
      scanResults.urlStructure.flags?.forEach((flag: string) => {
        findings.push({
          type: 'url_structure',
          description: flag.replace(/_/g, ' '),
          riskScore: scanResults.urlStructure.riskScore || 0,
        });
      });
    }

    if (scanResults.pageContent) {
      scanResults.pageContent.flags?.forEach((flag: string) => {
        findings.push({
          type: 'page_content',
          description: flag.replace(/_/g, ' '),
          riskScore: scanResults.pageContent.riskScore || 0,
        });
      });
    }

    if (scanResults.formRisk && Array.isArray(scanResults.formRisk)) {
      scanResults.formRisk.forEach((form: any) => {
        form.flags?.forEach((flag: string) => {
          findings.push({
            type: 'form_risk',
            description: `Form ${form.formIndex}: ${flag.replace(/_/g, ' ')}`,
            riskScore: form.riskScore || 0,
          });
        });
      });
    }

    if (scanResults.tlsAudit) {
      scanResults.tlsAudit.flags?.forEach((flag: string) => {
        findings.push({
          type: 'tls_security',
          description: flag.replace(/_/g, ' '),
          riskScore: scanResults.tlsAudit.riskScore || 0,
        });
      });
    }

    if (scanResults.reputation) {
      scanResults.reputation.flags?.forEach((flag: string) => {
        findings.push({
          type: 'reputation',
          description: flag.replace(/_/g, ' '),
          riskScore: scanResults.reputation.riskScore || 0,
        });
      });
    }

    if (scanResults.whois) {
      scanResults.whois.flags?.forEach((flag: string) => {
        findings.push({
          type: 'whois',
          description: flag.replace(/_/g, ' '),
          riskScore: scanResults.whois.riskScore || 0,
        });
      });
    }

    if (scanResults.ipRisk) {
      scanResults.ipRisk.flags?.forEach((flag: string) => {
        findings.push({
          type: 'ip_risk',
          description: flag.replace(/_/g, ' '),
          riskScore: scanResults.ipRisk.riskScore || 0,
        });
      });
    }

    const overallRiskScore = scanResults.riskScore?.overallRiskScore || 0;

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical';
    if (overallRiskScore < 30) {
      severity = 'low';
    } else if (overallRiskScore < 60) {
      severity = 'medium';
    } else if (overallRiskScore < 85) {
      severity = 'high';
    } else {
      severity = 'critical';
    }

    // Determine category
    let category = 'unknown';
    if (findings.some(f => f.description.includes('phishing'))) {
      category = 'phishing';
    } else if (findings.some(f => f.description.includes('malware'))) {
      category = 'malware';
    } else if (findings.some(f => f.description.includes('brand'))) {
      category = 'brand_impersonation';
    } else if (findings.some(f => f.description.includes('credential'))) {
      category = 'credential_theft';
    }

    const recommendation = scanResults.riskScore?.explanation || 'Review findings and take appropriate action';

    const report: IncidentReport = {
      id,
      timestamp,
      url,
      severity,
      category,
      findings,
      overallRiskScore,
      recommendation,
      metadata: {},
      siemReady: true,
    };

    // Store report (in production, send to SIEM or database)
    await storeIncidentReport(report);

    logger.info(`Incident report generated: ${id} (severity: ${severity})`);

    return report;
  } catch (error) {
    logger.error('Error generating incident report:', error);
    throw error;
  }
}

/**
 * Store incident report to file system (in production, use database/SIEM)
 */
async function storeIncidentReport(report: IncidentReport): Promise<void> {
  try {
    const reportsDir = path.join(process.cwd(), 'data', 'incidents');
    await fs.mkdir(reportsDir, { recursive: true });

    const filename = `${report.id}.json`;
    const filepath = path.join(reportsDir, filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    logger.info(`Incident report stored: ${filepath}`);
  } catch (error) {
    logger.error('Error storing incident report:', error);
    // Don't throw - report generation should succeed even if storage fails
  }
}

/**
 * Submit user feedback
 */
export async function submitUserFeedback(
  url: string,
  feedbackType: 'false_positive' | 'confirmed_phish' | 'benign_test' | 'other',
  comment?: string,
  incidentId?: string,
  userId?: string
): Promise<UserFeedback> {
  try {
    const id = `FB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const feedback: UserFeedback = {
      id,
      timestamp,
      url,
      incidentId,
      feedbackType,
      comment,
      userId,
    };

    // Store feedback
    await storeFeedback(feedback);

    // Update learning model (in production)
    await updateLearningModel(feedback);

    logger.info(`User feedback submitted: ${id} (type: ${feedbackType})`);

    return feedback;
  } catch (error) {
    logger.error('Error submitting user feedback:', error);
    throw error;
  }
}

/**
 * Store feedback to file system
 */
async function storeFeedback(feedback: UserFeedback): Promise<void> {
  try {
    const feedbackDir = path.join(process.cwd(), 'data', 'feedback');
    await fs.mkdir(feedbackDir, { recursive: true });

    const filename = `${feedback.id}.json`;
    const filepath = path.join(feedbackDir, filename);

    await fs.writeFile(filepath, JSON.stringify(feedback, null, 2));
    logger.info(`Feedback stored: ${filepath}`);
  } catch (error) {
    logger.error('Error storing feedback:', error);
  }
}

/**
 * Update learning model based on feedback
 */
async function updateLearningModel(feedback: UserFeedback): Promise<void> {
  try {
    // In production, this would:
    // 1. Update ML model weights
    // 2. Adjust risk scoring thresholds
    // 3. Update pattern recognition
    // 4. Feed into Letta for continuous learning

    logger.info(`Learning model updated with feedback: ${feedback.feedbackType}`);
  } catch (error) {
    logger.error('Error updating learning model:', error);
  }
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats(): Promise<FeedbackStats> {
  try {
    const feedbackDir = path.join(process.cwd(), 'data', 'feedback');
    
    try {
      await fs.access(feedbackDir);
    } catch {
      return {
        total: 0,
        falsePositives: 0,
        confirmedPhish: 0,
        benignTests: 0,
        other: 0,
      };
    }

    const files = await fs.readdir(feedbackDir);
    const stats: FeedbackStats = {
      total: files.length,
      falsePositives: 0,
      confirmedPhish: 0,
      benignTests: 0,
      other: 0,
    };

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filepath = path.join(feedbackDir, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const feedback: UserFeedback = JSON.parse(content);

      switch (feedback.feedbackType) {
        case 'false_positive':
          stats.falsePositives++;
          break;
        case 'confirmed_phish':
          stats.confirmedPhish++;
          break;
        case 'benign_test':
          stats.benignTests++;
          break;
        default:
          stats.other++;
      }
    }

    return stats;
  } catch (error) {
    logger.error('Error getting feedback stats:', error);
    throw error;
  }
}

/**
 * Get recent incidents
 */
export async function getRecentIncidents(limit: number = 10): Promise<IncidentReport[]> {
  try {
    const reportsDir = path.join(process.cwd(), 'data', 'incidents');
    
    try {
      await fs.access(reportsDir);
    } catch {
      return [];
    }

    const files = await fs.readdir(reportsDir);
    const reports: IncidentReport[] = [];

    // Sort by timestamp (newest first)
    const sortedFiles = files
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const timeA = parseInt(a.split('-')[1]);
        const timeB = parseInt(b.split('-')[1]);
        return timeB - timeA;
      })
      .slice(0, limit);

    for (const file of sortedFiles) {
      const filepath = path.join(reportsDir, file);
      const content = await fs.readFile(filepath, 'utf-8');
      reports.push(JSON.parse(content));
    }

    return reports;
  } catch (error) {
    logger.error('Error getting recent incidents:', error);
    throw error;
  }
}
