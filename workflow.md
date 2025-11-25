# NetWatch Workflow Documentation

## Development Workflow

### 1. Setup and Initialization

1. **Environment Setup**
   - Copy `.env.example` to `.env`
   - Configure all required API keys
   - Set network configuration

2. **Dependencies**
   ```bash
   npm install
   ```

3. **Build**
   ```bash
   npm run build
   ```

### 2. Development Process

#### Iterative Development Cycle

1. **Reflect on Problems** (5-7 sources)
   - Identify potential issues
   - Analyze root causes
   - Distill to 1-2 core problems

2. **Add Logging**
   - Add logs to validate assumptions
   - Use structured logging with appropriate levels
   - Log security events for analytics

3. **Implement Fix**
   - Make targeted changes
   - Follow modular architecture
   - Maintain type safety

4. **Test**
   - Test in chat mode
   - Test in monitor mode
   - Verify security analytics

5. **Tidy Code**
   - Review and refactor
   - Ensure consistency
   - Update documentation

### 3. Git Workflow

#### Branch Strategy
- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: Feature branches
- `fix/*`: Bug fix branches

#### Commit Messages
- Use descriptive commit messages
- Follow conventional commits format
- Reference issues when applicable

#### Version Management
- Use semantic versioning
- Tag releases appropriately
- Maintain changelog

### 4. Code Quality

#### Linting
```bash
npm run lint
npm run lint:fix
```

#### Formatting
```bash
npm run format
npm run format:check
```

#### Type Checking
```bash
npm run build
```

### 5. Security Considerations

#### Before Deployment
- Review all security actions
- Verify API key security
- Check network configuration
- Validate error handling

#### Monitoring
- Monitor security events
- Review analytics regularly
- Check for anomalies
- Update threat detection rules

### 6. Testing Workflow

#### Manual Testing
1. Start agent in chat mode
2. Test each security action
3. Verify analytics collection
4. Test error scenarios

#### Automated Testing (Future)
- Unit tests for action providers
- Integration tests for agent
- Security event tests
- Analytics tests

### 7. Deployment

#### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Logging configured
- [ ] Analytics working

#### Deployment Steps
1. Build project: `npm run build`
2. Verify environment configuration
3. Start agent: `npm start`
4. Monitor initial startup
5. Verify security monitoring

### 8. Maintenance

#### Regular Tasks
- Review security events weekly
- Update threat detection rules
- Monitor API rate limits
- Review and update dependencies
- Clean old analytics data

#### Updates
- Keep dependencies up to date
- Monitor AgentKit updates
- Update security rules as needed
- Improve detection algorithms

## Problem-Solving Workflow

### When Issues Arise

1. **Identify Problem** (5-7 potential sources)
   - Check logs
   - Review error messages
   - Analyze security events
   - Check API responses
   - Verify network connectivity
   - Review configuration
   - Check dependencies

2. **Distill to Core Issues** (1-2 main problems)
   - Root cause analysis
   - Prioritize by impact
   - Focus on critical issues first

3. **Add Logging**
   - Add debug logs
   - Log assumptions
   - Track state changes
   - Monitor performance

4. **Validate Assumptions**
   - Test hypotheses
   - Verify with logs
   - Confirm expected behavior

5. **Implement Fix**
   - Make targeted changes
   - Follow existing patterns
   - Maintain modularity

6. **Verify Solution**
   - Test thoroughly
   - Check logs
   - Verify analytics
   - Confirm security

7. **Tidy Code**
   - Refactor if needed
   - Update documentation
   - Clean up temporary code
   - Review for improvements

## Code Organization Principles

### Modularity
- Separate concerns
- Reusable components
- Clear interfaces
- Independent modules

### Interoperability
- Standard interfaces
- Well-defined APIs
- Compatible with AgentKit
- Extensible architecture

### Programmatic over Hardcode
- Configuration-driven
- Environment-based settings
- Dynamic behavior
- Flexible parameters

### Production-Ready
- No mocks or simulations
- Real API integrations
- Proper error handling
- Comprehensive logging

## Security Workflow

### Threat Detection Process

1. **Monitor**
   - Continuous monitoring
   - Event collection
   - Pattern detection

2. **Analyze**
   - Risk scoring
   - Severity assessment
   - Pattern analysis

3. **Alert**
   - Immediate alerts for high risk
   - Logging for all events
   - Analytics aggregation

4. **Respond**
   - Automated responses where safe
   - User notification
   - Documentation

### Security Event Lifecycle

1. Event occurs
2. Detection triggers
3. Analysis performed
4. Risk score calculated
5. Event logged
6. Alert sent (if needed)
7. Analytics updated
8. Summary generated

## Analytics Workflow

### Event Collection
- All security events logged
- Structured data format
- Timestamp tracking
- Risk score included

### Aggregation
- Time-window summaries
- Severity breakdowns
- Type categorization
- Average risk scores

### Reporting
- Real-time summaries
- Historical analysis
- Trend identification
- Pattern recognition

## Multi-Level Analyst System

NetWatch supports 5 levels of capability, from air-gapped local analysis to full agent commerce:

### Level 1 - Local Analyst (No Network)
**Capabilities:**
- Pure log/email/config analysis with local model
- Air-gapped mode - no network access
- Classify incidents, explain attack paths, propose remediations

**Use Cases:**
- Analyzing log files for security incidents
- Email phishing detection
- Configuration file security audits
- Incident classification

**Actions Available:**
- `analyze_logs` - Analyze log files for security patterns
- `analyze_email` - Detect phishing and email threats
- `analyze_config` - Find security misconfigurations
- `classify_incident` - Classify security incidents

**Workflow:**
1. User provides log/email/config files
2. Agent analyzes locally (no network calls)
3. Returns classification, risk scores, and remediation recommendations

### Level 2 - Intel-Enhanced Analyst (Web Search)
**Capabilities:**
- Adds read-only HTTP access
- CVE database lookups
- IP/domain reputation checks
- OSINT gathering
- Vendor documentation search

**Use Cases:**
- Looking up CVE details for vulnerabilities
- Checking IP/domain reputation
- Gathering threat intelligence
- Finding vendor security advisories

**Actions Available:**
- All Level 1 actions
- `search_cve` - Search CVE database
- `check_ip_reputation` - Check IP address reputation
- `check_domain_reputation` - Check domain reputation
- `osint_search` - Perform OSINT searches
- `search_vendor_docs` - Search vendor documentation

**Workflow:**
1. Agent receives security query
2. Performs web searches for threat intelligence
3. Correlates findings with local analysis
4. Provides comprehensive security assessment

### Level 3 - Tool-Using Responder (MCP)
**Capabilities:**
- Uses MCP (Model Context Protocol) tools
- Run security scans
- Fetch logs from systems
- Open tickets in issue trackers
- Propose pull requests
- All actions audited and whitelisted

**Use Cases:**
- Running automated security scans
- Fetching logs from production systems
- Creating tickets for security issues
- Proposing security fixes via PRs

**Actions Available:**
- All Level 1 & 2 actions
- `mcp_run_scan` - Run security scans
- `mcp_fetch_logs` - Fetch system logs
- `mcp_open_ticket` - Open tickets
- `mcp_propose_pr` - Propose pull requests
- `mcp_list_tools` - List available MCP tools

**Workflow:**
1. Agent identifies security issue
2. Uses MCP tools to gather more information
3. Runs scans or fetches logs
4. Creates tickets or PRs for remediation
5. All actions logged and audited

### Level 4A - A2A Coordination (No Payments)
**Capabilities:**
- Multi-agent coordination
- Agent discovery and task routing
- Scanner, triage, fix, and governance agents
- A2A messaging protocol

**Use Cases:**
- Coordinating with specialized agents
- Routing tasks to appropriate agents
- Multi-agent security workflows

**Actions Available:**
- All Level 1, 2, & 3 actions
- `a2a_discover_agents` - Discover other agents
- `a2a_request_task` - Request task from agent
- `a2a_route_task` - Route task to best agent
- `a2a_get_status` - Get A2A network status

**Workflow:**
1. Agent discovers available specialized agents
2. Routes tasks to appropriate agents (scanner, triage, fix)
3. Coordinates multi-agent security response
4. Aggregates results from multiple agents

### Level 4B - A2A + x402 Payments (Agent Commerce)
**Capabilities:**
- All Level 4A capabilities
- Agent-to-agent payments using x402 protocol
- HTTP 402 Payment Required handling
- USDC payments on Base/Solana
- Pay for premium threat intel, scans, bug bounties

**Use Cases:**
- Paying for premium threat intelligence APIs
- Paying for one-off security scans
- Paying bug bounty agents for validated findings
- Agent commerce transactions

**Actions Available:**
- All Level 1, 2, 3, & 4A actions
- `x402_request_resource` - Request priced resource (triggers HTTP 402)
- `x402_submit_payment` - Submit x402 payment
- `x402_pay_bug_bounty` - Pay bug bounty agent
- `x402_get_payment_history` - View payment history
- `x402_handle_402_response` - Handle HTTP 402 response

**Workflow:**
1. Agent requests priced resource
2. Server returns HTTP 402 with payment terms
3. Agent constructs and submits x402 payment (USDC)
4. Payment verified on blockchain
5. Resource returned after verification

### Level Selection

**Via Environment Variable:**
```bash
ANALYST_LEVEL=level_1_local  # or level_2_intel, level_3_tools, level_4a_a2a, level_4b_x402
```

**Via Chat Interface:**
- Type `switch 1` to switch to Level 1
- Type `switch 2` to switch to Level 2
- Type `switch 3` to switch to Level 3
- Type `switch 4a` to switch to Level 4A
- Type `switch 4b` to switch to Level 4B

**Via Web UI:**
- Use the level dropdown in the header
- Level changes are applied immediately
- Agent reinitializes with new capabilities

**Via API:**
```bash
# Get current level
GET /api/levels

# Switch level
POST /api/level
{
  "level": "level_2_intel"
}
```

### Level-Specific Considerations

**Level 1:**
- No network access required
- Works completely offline
- Safe for air-gapped environments
- No API keys needed (except OpenAI)

**Level 2:**
- Requires network access
- May need API keys for threat intel services
- Rate limits may apply to web searches

**Level 3:**
- Requires MCP server connection
- Needs authentication for MCP tools
- Actions are audited and whitelisted

**Level 4A:**
- Requires A2A network connectivity
- Other agents must be available
- Task routing depends on agent availability

**Level 4B:**
- Requires wallet with USDC balance
- Needs blockchain network access
- Payment transactions incur gas fees

## Best Practices

1. **Always log security events**
2. **Validate inputs thoroughly**
3. **Handle errors gracefully**
4. **Maintain type safety**
5. **Follow modular design**
6. **Keep code DRY**
7. **Document changes**
8. **Test before deploying**
9. **Monitor continuously**
10. **Update regularly**
11. **Choose appropriate level for your use case**
12. **Start with Level 1 for air-gapped environments**
13. **Upgrade levels incrementally as needed**

