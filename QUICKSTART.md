# VeriSense Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Create a `.env` file in the root directory:
```bash
# Required
CDP_API_KEY_ID=your_cdp_api_key_id
CDP_API_KEY_SECRET=your_cdp_api_key_secret
CDP_WALLET_SECRET=your_cdp_wallet_secret
OPENAI_API_KEY=your_openai_api_key

# Optional
NETWORK_ID=base-sepolia
MONITORING_INTERVAL_SECONDS=30
LOG_LEVEL=info
```

### Step 3: Run the Agent
```bash
npm start
```

### Step 4: Choose Mode
- **Chat Mode**: Interactive security analysis
- **Monitor Mode**: Continuous automated monitoring

## 📝 Example Commands (Chat Mode)

```
[VeriSense] > Analyze transaction 0x1234...
[VeriSense] > Check address 0xabcd... for security risks
[VeriSense] > Monitor my wallet balance
[VeriSense] > Get security summary
[VeriSense] > summary  # Quick analytics summary
```

## 🔍 What VeriSense Does

1. **Monitors Transactions**: Detects suspicious patterns, large transfers, failed transactions
2. **Analyzes Addresses**: Checks for contracts, balance anomalies, security risks
3. **Protects Wallet**: Monitors balance, detects unauthorized access
4. **Tracks Security Events**: Logs all security events with risk scores

## 🎯 Key Features

- ✅ Real-time threat detection
- ✅ Risk scoring (LOW/MEDIUM/HIGH)
- ✅ Security analytics
- ✅ Automated monitoring
- ✅ Comprehensive logging

## 🆘 Troubleshooting

**Issue**: Missing API keys
**Solution**: Ensure all required environment variables are set in `.env`

**Issue**: Network errors
**Solution**: Check network connectivity and RPC endpoints

**Issue**: Wallet errors
**Solution**: Verify CDP wallet secret is correct

## 📚 Next Steps

- Read [README.md](./README.md) for detailed documentation
- Check [workflow.md](./workflow.md) for development guidelines
- Explore the code in `src/` directory

---

**Ready to secure your blockchain operations!** 🔒

