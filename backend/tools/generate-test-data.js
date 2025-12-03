#!/usr/bin/env node

/**
 * Generate test data for development
 * This file is not committed to GitHub
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Generating test data...');

// Generate sample incident reports
const incidents = [];
for (let i = 0; i < 10; i++) {
  incidents.push({
    id: `INC-${Date.now() - i * 1000}-test${i}`,
    timestamp: new Date(Date.now() - i * 86400000).toISOString(),
    url: `https://test-phishing-${i}.com`,
    severity: ['low', 'medium', 'high', 'critical'][i % 4],
    category: 'phishing',
    findings: [
      {
        type: 'url_structure',
        description: 'suspicious url pattern',
        riskScore: 50 + i * 5,
      },
    ],
    overallRiskScore: 50 + i * 5,
    recommendation: 'Review and block',
    metadata: {},
    siemReady: true,
  });
}

// Create data directory
const dataDir = path.join(__dirname, '../../data/incidents');
fs.mkdirSync(dataDir, { recursive: true });

// Write incidents
incidents.forEach((incident) => {
  const filename = path.join(dataDir, `${incident.id}.json`);
  fs.writeFileSync(filename, JSON.stringify(incident, null, 2));
});

console.log(`✅ Generated ${incidents.length} test incidents`);
console.log(`📁 Saved to: ${dataDir}`);
