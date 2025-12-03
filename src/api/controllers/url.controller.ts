/**
 * URL analysis controller
 */
import { Request, Response } from 'express';
import { extractUrlFeatures, analyzePhishingRedFlags } from '../../services/url-analysis.service';

export async function handleUrlCheck(req: Request, res: Response) {
  const { url } = req.body;
  
  try {
    const features = extractUrlFeatures(url);
    const result = analyzePhishingRedFlags(features);

    return res.json({
      url,
      features,
      verdict: result.verdict,
      redFlags: result.redFlags,
      explanation: result.explanation,
    });
  } catch (e) {
    console.error('Error in /check:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}
