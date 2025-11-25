/**
 * Security Analytics Module
 * Provides analytics and reporting capabilities for security monitoring
 */

import { logger } from "./logger";

export interface SecurityEvent {
  type: "transaction" | "address" | "balance" | "alert";
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
  data: Record<string, unknown>;
  riskScore?: number;
}

export class SecurityAnalytics {
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 1000; // Keep last 1000 events

  /**
   * Record a security event
   */
  recordEvent(event: SecurityEvent): void {
    this.events.push(event);
    
    // Keep only the most recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log based on severity
    const message = `Security Event: ${event.type} - ${event.severity.toUpperCase()}`;
    switch (event.severity) {
      case "critical":
      case "high":
        logger.error(message, event.data);
        break;
      case "medium":
        logger.warn(message, event.data);
        break;
      default:
        logger.info(message, event.data);
    }
  }

  /**
   * Get security summary statistics
   */
  getSummary(timeWindowHours: number = 24): {
    totalEvents: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    averageRiskScore: number;
    recentEvents: SecurityEvent[];
  } {
    const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    const recentEvents = this.events.filter(
      (e) => new Date(e.timestamp) >= cutoffTime,
    );

    const bySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byType: Record<string, number> = {};

    let totalRiskScore = 0;
    let riskScoreCount = 0;

    recentEvents.forEach((event) => {
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      byType[event.type] = (byType[event.type] || 0) + 1;
      
      if (event.riskScore !== undefined) {
        totalRiskScore += event.riskScore;
        riskScoreCount++;
      }
    });

    return {
      totalEvents: recentEvents.length,
      bySeverity,
      byType,
      averageRiskScore: riskScoreCount > 0 ? totalRiskScore / riskScoreCount : 0,
      recentEvents: recentEvents.slice(-10), // Last 10 events
    };
  }

  /**
   * Get all events
   */
  getAllEvents(): SecurityEvent[] {
    return [...this.events];
  }

  /**
   * Clear old events
   */
  clearEvents(olderThanDays: number = 7): void {
    const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    this.events = this.events.filter((e) => new Date(e.timestamp) >= cutoffTime);
    logger.info(`Cleared events older than ${olderThanDays} days`);
  }
}

export const securityAnalytics = new SecurityAnalytics();

