# Letta Integration - Autonomous Learning & Self-Improvement

## Overview

WebWatcher now integrates with [Letta](https://app.letta.com/) to enable **autonomous, self-improving agents** that can:
- **Remember** past interactions across conversations
- **Learn** from security patterns and threat detection results
- **Improve** threat detection accuracy over time
- **Act autonomously** based on learned patterns without explicit instruction
- **Access real-time data** via web search capabilities

## What Letta Adds

### 1. Long-Term Memory
- Conversations persist across sessions
- Security patterns are remembered
- Context-aware analysis based on history

### 2. Self-Improvement
- Learns from every interaction
- Improves risk scoring based on historical data
- Remembers successful remediation strategies
- Reduces false positives over time

### 3. Autonomous Actions
- Can decide on actions based on learned patterns
- Escalates threats automatically when patterns match
- Coordinates with other agents proactively
- Monitors security events continuously

### 4. Real-Time Data Access
- Web search capabilities via Letta's tools
- Access to latest threat intelligence
- Real-time CVE and vulnerability data

## Setup

### 1. Get Letta API Key

1. Sign up at [app.letta.com](https://app.letta.com/)
2. Create a project (or use default)
3. Get your API token from the dashboard

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Letta Integration (Optional - enables autonomous learning)
LETTA_API_KEY=your_letta_api_key_here
LETTA_PROJECT=webwatcher-cybersecurity  # Optional, defaults to 'webwatcher-cybersecurity'
LETTA_AGENT_ID=agent_xxx  # Optional, reuse existing agent
LETTA_MODEL=openai/gpt-4o-mini  # Optional, model for Letta agent
LETTA_EMBEDDING=openai/text-embedding-3-small  # Optional, embedding model
LETTA_ENABLE_WEB_SEARCH=true  # Optional, enable web search in Letta
```

### 3. For Cloud Run Deployment

Set environment variables in Cloud Run:

```bash
gcloud run services update verisense-agentkit \
  --region us-central1 \
  --update-env-vars "LETTA_API_KEY=your_key,LETTA_PROJECT=webwatcher-cybersecurity"
```

## How It Works

### Learning Loop

Every interaction is automatically stored in Letta's memory:

```typescript
// Automatically called after each chat response
learnFromInteraction(userMessage, agentResponse, {
  actionsTaken: ['exa_search', 'scan_website'],
  riskScore: 75,
  threatDetected: true,
  accuracy: 'correct'
});
```

### Memory Blocks

The agent has persistent memory blocks:
- **Persona**: Cybersecurity agent identity and capabilities
- **Capabilities**: Core security analysis features
- **Learning**: What patterns it learns from
- **Autonomous Actions**: When and how it acts autonomously

### Autonomous Actions

The agent can decide on actions autonomously:

```typescript
const action = await autonomousAction({
  securityEvents: [...],
  riskLevel: 'high',
  currentState: 'monitoring'
});

// Returns: { action: 'escalate_threat', reasoning: 'Pattern matches previous critical incidents' }
```

## Integration Points

### 1. Agent Initialization

Letta is initialized when the agent starts:

```typescript
// In src/index.ts
const lettaEnabled = await initializeLetta();
if (lettaEnabled) {
  logger.info("✓ Letta integration active - autonomous learning enabled");
}
```

### 2. Chat Endpoint

Learning happens automatically after each response:

```typescript
// In src/server.ts - /api/chat endpoint
learnFromInteraction(sanitizedMessage, enhancedResponse, {
  actionsTaken,
  riskScore,
  threatDetected,
});
```

### 3. System Prompt

The agent knows about its learning capabilities:

```
**Autonomous Learning & Self-Improvement**:
- You learn from every interaction to improve threat detection accuracy
- Past security patterns inform future analysis
- Risk scoring improves based on historical data
- You remember successful remediation strategies
- Autonomous actions are taken when patterns indicate high-risk scenarios
```

## API Endpoints

### Check Letta Status

The `/api/chat` response includes:

```json
{
  "response": "...",
  "chunks": [...],
  "threadId": "...",
  "lettaEnabled": true  // Indicates if Letta is active
}
```

## Usage Examples

### Example 1: Learning from False Positives

**Interaction 1:**
```
User: "Is example.com safe?"
Agent: "Risk Score: 85 - HIGH RISK detected"
```

**Interaction 2 (after learning):**
```
User: "Is example.com safe?"
Agent: "Risk Score: 45 - MEDIUM RISK (learned from past analysis)"
```

### Example 2: Autonomous Threat Escalation

When patterns match learned high-risk scenarios:

```typescript
// Agent autonomously decides:
{
  action: "escalate_to_triage_agent",
  reasoning: "Pattern matches previous critical phishing campaign"
}
```

### Example 3: Context-Aware Analysis

Agent remembers past conversations:

```
User: "What about that wallet we analyzed yesterday?"
Agent: "Based on our previous analysis of wallet 0x123..., I see..."
```

## Benefits

### 1. Improved Accuracy
- Reduces false positives over time
- Learns from user feedback
- Better risk scoring based on history

### 2. Autonomous Operation
- Acts without explicit instruction
- Escalates threats automatically
- Monitors continuously

### 3. Context Awareness
- Remembers past conversations
- Understands user preferences
- Provides personalized analysis

### 4. Continuous Improvement
- Gets better with each interaction
- Learns from mistakes
- Adapts to new threat patterns

## Architecture

```
┌─────────────────┐
│  WebWatcher     │
│  Agent          │
└────────┬────────┘
         │
         ├─── LangChain Memory (short-term)
         │
         └─── Letta Memory (long-term)
                  │
                  ├─── Memory Blocks
                  ├─── Learned Patterns
                  └─── Autonomous Actions
```

## Troubleshooting

### Letta Not Enabled

**Symptom**: `lettaEnabled: false` in responses

**Solution**: 
1. Check `LETTA_API_KEY` is set
2. Verify API key is valid
3. Check logs for initialization errors

### Learning Not Working

**Symptom**: Agent doesn't seem to learn from interactions

**Solution**:
1. Check Letta agent was created successfully
2. Verify memory blocks are set
3. Check logs for learning errors (non-critical, won't fail requests)

### Autonomous Actions Not Triggering

**Symptom**: Agent doesn't act autonomously

**Solution**:
1. Ensure enough interactions have occurred (needs data to learn)
2. Check `autonomousAction()` is being called
3. Verify risk levels and patterns match learned thresholds

## Best Practices

1. **Start with Learning**: Let the agent learn from interactions before relying on autonomous actions
2. **Monitor Patterns**: Review learned insights periodically
3. **Provide Feedback**: Explicit feedback helps learning
4. **Use Consistent Threads**: Same thread ID maintains context
5. **Review Autonomous Actions**: Monitor what actions are taken autonomously

## Limitations

- Letta is **optional** - agent works without it
- Learning is **non-blocking** - failures don't affect responses
- Autonomous actions require **sufficient data** to learn patterns
- Memory is **project-scoped** - separate projects have separate memory

## Future Enhancements

- [ ] Explicit feedback mechanism for learning
- [ ] Learned pattern visualization
- [ ] Autonomous action audit log
- [ ] Multi-agent learning coordination
- [ ] Custom memory block management

## Resources

- [Letta Documentation](https://docs.letta.com/)
- [Letta SDK](https://www.npmjs.com/package/@letta-ai/letta-client)
- [Letta Platform](https://app.letta.com/)

