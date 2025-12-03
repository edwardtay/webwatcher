/**
 * Security analysis routes
 */
import { Router } from 'express';
import { validateUrl } from '../middleware/validation';
import {
  handleRedirectAnalysis,
  handlePageContentScan,
  handleFormInspection,
  handleTLSAudit,
  handleReputationLookup,
  handleWhoisCheck,
  handleIPRiskProfile,
  handleBreachCheck,
  handleCategoryClassification,
  handlePolicyCheck,
  handleRiskScoreCalculation,
  handleIncidentReportGeneration,
  handleFeedbackSubmission,
  handleFeedbackStats,
  handleRecentIncidents,
  handleComprehensiveScan,
} from '../controllers/security.controller';

const router = Router();

// Layer A: Deeper URL and page analysis
router.post('/security/analyze-redirects', validateUrl, handleRedirectAnalysis);
router.post('/security/scan-page-content', validateUrl, handlePageContentScan);
router.post('/security/inspect-forms', validateUrl, handleFormInspection);
router.post('/security/audit-tls', validateUrl, handleTLSAudit);

// Layer B: Threat intelligence and reputation
router.post('/security/lookup-reputation', validateUrl, handleReputationLookup);
router.post('/security/check-whois', handleWhoisCheck);
router.post('/security/ip-risk-profile', handleIPRiskProfile);
router.post('/security/breach-check', handleBreachCheck);

// Layer C: User and policy context
router.post('/security/classify-category', validateUrl, handleCategoryClassification);
router.post('/security/check-policy', validateUrl, handlePolicyCheck);
router.post('/security/calculate-risk-score', validateUrl, handleRiskScoreCalculation);

// Layer D: Incident and feedback loop
router.post('/security/generate-incident-report', validateUrl, handleIncidentReportGeneration);
router.post('/security/submit-feedback', validateUrl, handleFeedbackSubmission);
router.get('/security/feedback-stats', handleFeedbackStats);
router.get('/security/recent-incidents', handleRecentIncidents);

// Comprehensive scan (all layers)
router.post('/security/comprehensive-scan', validateUrl, handleComprehensiveScan);

export default router;
