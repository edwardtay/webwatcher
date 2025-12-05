/**
 * A2A (Agent-to-Agent) Protocol Routes
 * Implements A2A v0.2.6 specification
 */
import { Router } from 'express';
import { handleA2ARequest } from '../controllers/a2a.controller';

const router = Router();

// A2A protocol endpoint (POST only)
router.post('/a2a', handleA2ARequest);

// Friendly GET handler for humans visiting in browser
router.get('/a2a', (_req, res) => {
  res.status(200).json({
    service: 'WebWatcher A2A Endpoint',
    protocol: 'A2A v0.2.6 (JSON-RPC 2.0)',
    method: 'POST',
    contentType: 'application/json',
    documentation: 'https://a2a-protocol.org/v0.2.6/specification/',
    agentCard: '/.well-known/agent.json',
    example: {
      request: {
        jsonrpc: '2.0',
        method: 'message/send',
        params: {
          message: {
            role: 'user',
            parts: [
              {
                kind: 'data',
                data: { url: 'https://example.com' },
              },
            ],
          },
          metadata: {
            skillId: 'scanUrl',
          },
        },
        id: '1',
      },
      note: 'The skillId in metadata is optional. If omitted, the agent will auto-route based on message content.',
      response: {
        jsonrpc: '2.0',
        result: {
          task: {
            id: 'task-123',
            status: 'completed',
            result: {
              riskScore: 0,
              verdict: 'safe',
              threats: [],
            },
          },
        },
        id: '1',
      },
    },
    availableSkills: [
      {
        name: 'scanUrl',
        description: 'Comprehensive URL security scan',
        params: { url: 'string' },
      },
      {
        name: 'checkDomain',
        description: 'Domain intelligence and WHOIS analysis',
        params: { domain: 'string' },
      },
      {
        name: 'analyzeEmail',
        description: 'Email phishing detection',
        params: { email: 'string' },
      },
      {
        name: 'breachCheck',
        description: 'Data breach detection via HaveIBeenPwned',
        params: { email: 'string' },
      },
    ],
    usage: {
      withSkillId: `curl -X POST https://webwatcher.lever-labs.com/a2a \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"data","data":{"url":"https://example.com"}}]},"metadata":{"skillId":"scanUrl"}},"id":"1"}'`,
      autoRoute: `curl -X POST https://webwatcher.lever-labs.com/a2a \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"data","data":{"url":"https://example.com"}}]}},"id":"1"}'`,
    },
  });
});

export default router;
