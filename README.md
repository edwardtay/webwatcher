# VeriSense - Cybersecurity Agent for Blockchain

VeriSense is an advanced cybersecurity agent built on Coinbase AgentKit that specializes in blockchain security monitoring, threat detection, and transaction analysis. It provides real-time security analytics and proactive threat detection capabilities.

## 🎯 Features

### Core Capabilities

1. **Transaction Monitoring**
   - Real-time transaction analysis
   - Suspicious pattern detection
   - Risk scoring and severity assessment
   - Gas usage anomaly detection

2. **Address Analysis**
   - Contract vs EOA verification
   - Balance anomaly detection
   - Transaction history analysis
   - Threat indicator identification

3. **Wallet Security**
   - Balance monitoring
   - Unauthorized access detection
   - Security status reporting
   - Automated alerts

4. **Security Analytics**
   - Event logging and tracking
   - Risk score aggregation
   - Security summary reports
   - Historical analysis

## 🚀 Getting Started

### Prerequisites

- Node.js v22+ ([Download](https://nodejs.org/en/download/))
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [CDP Wallet Secret](https://portal.cdp.coinbase.com/products/wallet-api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd verisense-agentkit
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
CDP_API_KEY_ID=your_cdp_api_key_id_here
CDP_API_KEY_SECRET=your_cdp_api_key_secret_here
CDP_WALLET_SECRET=your_cdp_wallet_secret_here
OPENAI_API_KEY=your_openai_api_key_here
NETWORK_ID=base-sepolia
```

### Running the Agent

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

#### Build
```bash
npm run build
```

## 📖 Usage

### Modes of Operation

#### 1. Chat Mode (Interactive)
Interactive security analysis mode where you can:
- Analyze specific transactions
- Check address security
- Monitor wallet status
- Get security summaries

```bash
npm start
# Select option 1: chat
```

Example commands:
- `"Analyze transaction 0x1234..."`
- `"Check address 0xabcd... for security risks"`
- `"Get security summary"`
- `"Monitor my wallet balance"`

#### 2. Monitor Mode (Continuous)
Automated continuous security monitoring:
- Periodic security checks
- Automated threat detection
- Real-time alerts
- Security analytics

```bash
npm start
# Select option 2: monitor
```

### Security Actions

The agent provides the following security-focused actions:

#### `monitor_transaction`
Monitor a specific transaction for suspicious patterns:
```typescript
{
  transactionHash: "0x...",
  address?: "0x..." // optional
}
```

#### `analyze_address`
Analyze a blockchain address for security risks:
```typescript
{
  address: "0x...",
  lookbackDays?: 7 // optional, default 7
}
```

#### `monitor_wallet_balance`
Monitor the agent's wallet balance for anomalies:
```typescript
{
  threshold?: 0.01 // optional, default 0.01 ETH
}
```

#### `get_security_summary`
Get comprehensive security summary:
```typescript
{}
```

## 🏗️ Architecture

```
verisense-agentkit/
├── src/
│   ├── action-providers/
│   │   └── security.ts          # Custom security action provider
│   ├── utils/
│   │   ├── logger.ts            # Logging utility
│   │   └── security-analytics.ts # Security analytics module
│   └── index.ts                 # Main agent entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Key Components

1. **SecurityActionProvider**: Custom action provider with security-focused tools
2. **SecurityAnalytics**: Event tracking and analytics module
3. **Logger**: Structured logging utility
4. **Main Agent**: LangChain-based agent with security-focused system prompt

## 🔒 Security Features

### Risk Detection

- **Large Transfer Detection**: Alerts on transfers >100 ETH
- **Zero-Value Transaction Analysis**: Detects potential spam
- **Failed Transaction Monitoring**: Tracks reverted transactions
- **High Gas Usage Detection**: Identifies complex contract interactions
- **Balance Anomaly Detection**: Monitors for unexpected balance changes

### Risk Scoring

- **LOW**: Risk score 0-24
- **MEDIUM**: Risk score 25-49
- **HIGH**: Risk score 50+

### Threat Indicators

- Contract address verification
- Balance anomalies
- Transaction pattern analysis
- Gas usage patterns
- Failed transaction tracking

## 📊 Security Analytics

The agent maintains a security event log with:
- Event type classification
- Severity levels (low, medium, high, critical)
- Risk scores
- Timestamps
- Detailed event data

Access analytics via:
- Chat mode: Type `summary` for security summary
- Programmatic: `securityAnalytics.getSummary()`

## 🛠️ Development

### Project Structure

- **Modular Design**: Separate action providers, utilities, and core agent
- **Type Safety**: Full TypeScript with strict mode
- **Error Handling**: Comprehensive error handling and logging
- **Extensible**: Easy to add new security actions

### Adding New Security Actions

1. Extend `SecurityActionProvider` in `src/action-providers/security.ts`
2. Use `@CreateAction` decorator
3. Define schema with Zod
4. Implement action logic

Example:
```typescript
@CreateAction({
  name: "my_security_action",
  description: "Description of the action",
  schema: z.object({
    param: z.string(),
  }),
})
async mySecurityAction(
  walletProvider: WalletProvider,
  args: z.infer<typeof MySchema>,
): Promise<string> {
  // Implementation
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `CDP_API_KEY_ID` | CDP API Key ID | Yes | - |
| `CDP_API_KEY_SECRET` | CDP API Key Secret | Yes | - |
| `CDP_WALLET_SECRET` | CDP Wallet Secret | Yes | - |
| `OPENAI_API_KEY` | OpenAI API Key | Yes | - |
| `NETWORK_ID` | Network to use | No | `base-sepolia` |
| `MONITORING_INTERVAL_SECONDS` | Monitoring interval | No | `30` |
| `LOG_LEVEL` | Logging level | No | `info` |

### Supported Networks

- `base-sepolia` (default)
- `base-mainnet`
- `ethereum-sepolia`
- `ethereum-mainnet`

## 📝 Examples

### Example 1: Analyze a Transaction

```
[VeriSense] > Analyze transaction 0x1234567890abcdef1234567890abcdef12345678

Agent: Analyzing transaction...
Risk Level: MEDIUM
Risks Detected:
- High gas usage detected
Recommendation: Monitor closely
```

### Example 2: Check Address Security

```
[VeriSense] > Check address 0xabcdef1234567890abcdef1234567890abcdef12

Agent: Analyzing address...
Risk Level: LOW
Address appears normal
Balance: 0.5 ETH
```

### Example 3: Security Summary

```
[VeriSense] > summary

=== Security Analytics Summary ===
{
  "totalEvents": 15,
  "bySeverity": {
    "low": 10,
    "medium": 4,
    "high": 1
  },
  "averageRiskScore": 18.5
}
```

## 🤝 Contributing

This project follows a modular and extensible architecture. When contributing:

1. Follow the existing code structure
2. Add comprehensive error handling
3. Include logging for security events
4. Update documentation
5. Test thoroughly

## 📄 License

Apache-2.0

## 🙏 Acknowledgments

- Built with [Coinbase AgentKit](https://github.com/coinbase/agentkit)
- Powered by LangChain and OpenAI
- Designed for the "Calling for All Agents SF" hackathon

## 🔗 Resources

- [AgentKit Documentation](https://docs.cdp.coinbase.com/agent-kit)
- [CDP API Documentation](https://docs.cdp.coinbase.com/)
- [LangChain Documentation](https://js.langchain.com/)

## 🐛 Troubleshooting

### Common Issues

1. **Missing API Keys**: Ensure all required environment variables are set
2. **Network Issues**: Check network connectivity and RPC endpoints
3. **Wallet Errors**: Verify CDP wallet secret is correct
4. **Rate Limits**: Monitor API rate limits for OpenAI and CDP

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## 📧 Support

For issues and questions, please open an issue on the repository.

---

**Built for cybersecurity and blockchain security monitoring** 🔒

