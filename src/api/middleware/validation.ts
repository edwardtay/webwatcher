/**
 * Request validation middleware
 */
import { Request, Response, NextFunction } from 'express';

export function validateAddress(req: Request, res: Response, next: NextFunction) {
  const { address } = req.body;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Wallet address is required',
    });
  }
  
  const normalized = address.toLowerCase().trim();
  
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    return res.status(400).json({
      success: false,
      error: `Invalid Ethereum address format: ${address}`,
    });
  }
  
  req.body.address = normalized;
  next();
}

export function validateMessage(req: Request, res: Response, next: NextFunction) {
  const { message } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Message is required and must be a string',
    });
  }
  
  next();
}

export function validateUrl(req: Request, res: Response, next: NextFunction) {
  const { url } = req.body;
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'URL is required',
    });
  }
  
  next();
}
