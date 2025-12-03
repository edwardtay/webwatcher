# WebWatcher Refactoring Plan

## 🎯 Scope

**Refactor:** Everything except security logic, protocol adapters, and external spec interactions

**Keep Untouched:**
- ❌ Security analysis logic (threat detection, risk scoring)
- ❌ Protocol adapters (A2A, MCP implementations)
- ❌ External API integrations (VirusTotal, HaveIBeenPwned, etc.)
- ❌ Tool definitions and schemas

**Refactor:**
- ✅ Code organization and structure
- ✅ Error handling patterns
- ✅ Logging consistency
- ✅ Type definitions
- ✅ Configuration management
- ✅ Utility functions
- ✅ Route handlers (not the security logic they call)
- ✅ Middleware
- ✅ Frontend code

---

## 📁 Files to Refactor

### 1. Server & Configuration
- [ ] `src/server.ts` - Server initialization, middleware setup
- [ ] `src/config/server.config.ts` - Configuration management
- [ ] `src/config/agent.config.ts` - Agent configuration

### 2. API Layer (Routes & Middleware)
- [ ] `src/api/routes/index.ts` - Route organization
- [ ] `src/api/routes/health.routes.ts` - Health check routes
- [ ] `src/api/routes/url.routes.ts` - URL routes
- [ ] `src/api/middleware/cors.ts` - CORS middleware
- [ ] `src/api/middleware/error-handler.ts` - Error handling

### 3. Controllers (Keep Security Logic)
- [ ] `src/api/controllers/chat.controller.ts` - Request handling only
  - ✅ Refactor: Input validation, response formatting
  - ❌ Keep: Agent invocation, security analysis

### 4. Utilities
- [ ] `src/utils/logger.ts` - Logging utility
- [ ] `src/utils/error-handler.ts` - Error handling utilities
- [ ] `src/utils/input-validator.ts` - Input validation
- [ ] `src/utils/system-prompt.ts` - System prompt (structure only)

### 5. Frontend
- [ ] `frontend/index.html` - HTML structure, CSS, JavaScript
  - ✅ Refactor: Component organization, styling, event handlers
  - ❌ Keep: API endpoints, message formats

---

## 🔧 Refactoring Tasks

### Task 1: Improve Code Organization
**Goal:** Better separation of concerns

```typescript
// Before: Mixed concerns
export async function handleChat(req, res) {
  const message = req.body.message;
  // validation
  // agent call
  // response formatting
  // error handling
}

// After: Separated concerns
export async function handleChat(req, res) {
  const input = validateChatInput(req.body);
  const result = await processChat(input);
  return formatChatResponse(result);
}
```

**Files:**
- `src/api/controllers/chat.controller.ts`
- `src/api/controllers/security.controller.ts`

---

### Task 2: Standardize Error Handling
**Goal:** Consistent error handling across the app

```typescript
// Create error types
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class SecurityAnalysisError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SecurityAnalysisError';
  }
}

// Centralized error handler
export function handleError(error: Error, context: string) {
  if (error instanceof ValidationError) {
    logger.warn(`Validation error in ${context}:`, error.field);
    return { status: 400, message: error.message };
  }
  // ... other error types
}
```

**Files:**
- `src/utils/error-handler.ts` (new)
- `src/api/middleware/error-handler.ts`

---

### Task 3: Improve Type Safety
**Goal:** Better TypeScript types throughout

```typescript
// Create shared types
export interface ChatRequest {
  message: string;
  threadId?: string;
}

export interface ChatResponse {
  response: string;
  chunks: string[];
  threadId: string;
  lettaEnabled: boolean;
  metadata: ChatMetadata;
}

export interface ChatMetadata {
  a2aCoordinated: boolean;
  realTimeDataUsed: boolean;
  autonomousAction: boolean;
  toolsUsed: string[];
}
```

**Files:**
- `src/types/api.types.ts` (new)
- `src/types/security.types.ts` (new)
- All controllers and services

---

### Task 4: Configuration Management
**Goal:** Centralized, type-safe configuration

```typescript
// Before: Scattered env vars
const apiKey = process.env.OPENAI_API_KEY;
const port = process.env.PORT || 8080;

// After: Centralized config
export const config = {
  server: {
    port: getEnvNumber('PORT', 8080),
    nodeEnv: getEnvString('NODE_ENV', 'development'),
  },
  openai: {
    apiKey: getEnvString('OPENAI_API_KEY'),
    model: getEnvString('OPENAI_MODEL', 'gpt-4o-mini'),
  },
  letta: {
    apiKey: getEnvString('LETTA_API_KEY', ''),
    enabled: !!getEnvString('LETTA_API_KEY'),
  },
} as const;
```

**Files:**
- `src/config/index.ts` (new)
- `src/config/server.config.ts`
- `src/config/agent.config.ts`

---

### Task 5: Logging Consistency
**Goal:** Structured, consistent logging

```typescript
// Before: Inconsistent logging
console.log('Starting scan');
logger.info('Scan complete');
logger.warn('Error:', error);

// After: Structured logging
logger.info('scan.started', { url, timestamp });
logger.info('scan.completed', { url, riskScore, duration });
logger.error('scan.failed', { url, error: error.message, stack: error.stack });
```

**Files:**
- `src/utils/logger.ts`
- All files using logger

---

### Task 6: Frontend Refactoring
**Goal:** Better code organization and maintainability

```javascript
// Before: Inline everything
<script>
  function sendMessage() { /* 50 lines */ }
  function addMessage() { /* 30 lines */ }
  // ...
</script>

// After: Organized modules
<script>
  const ChatAPI = {
    sendMessage: async (message) => { /* ... */ },
    formatResponse: (data) => { /* ... */ },
  };
  
  const ChatUI = {
    addMessage: (content, type) => { /* ... */ },
    scrollToBottom: () => { /* ... */ },
  };
  
  const ChatApp = {
    init: () => { /* ... */ },
    handleSubmit: () => { /* ... */ },
  };
</script>
```

**Files:**
- `frontend/index.html`

---

### Task 7: Input Validation
**Goal:** Robust, reusable validation

```typescript
// Create validation schemas
export const chatInputSchema = z.object({
  message: z.string().min(1).max(5000),
  threadId: z.string().optional(),
});

export const urlInputSchema = z.object({
  url: z.string().url(),
});

// Use in controllers
export function validateChatInput(body: unknown): ChatRequest {
  return chatInputSchema.parse(body);
}
```

**Files:**
- `src/utils/validation.ts` (new)
- `src/utils/input-validator.ts`

---

## 📋 Implementation Order

### Phase 1: Foundation (Day 1)
1. ✅ Create type definitions (`src/types/`)
2. ✅ Improve error handling (`src/utils/error-handler.ts`)
3. ✅ Centralize configuration (`src/config/index.ts`)
4. ✅ Standardize logging (`src/utils/logger.ts`)

### Phase 2: API Layer (Day 2)
5. ✅ Refactor route handlers
6. ✅ Improve middleware
7. ✅ Update controllers (keep security logic)
8. ✅ Add input validation

### Phase 3: Frontend (Day 3)
9. ✅ Organize JavaScript code
10. ✅ Improve error handling
11. ✅ Better UI feedback

### Phase 4: Testing & Documentation (Day 4)
12. ✅ Add unit tests for utilities
13. ✅ Update documentation
14. ✅ Code review and cleanup

---

## 🚫 What NOT to Touch

### Security Services (Keep As-Is)
- `src/services/threat-intel.service.ts` - Threat intelligence logic
- `src/services/url-security.service.ts` - URL security analysis
- `src/services/url-analysis.service.ts` - URL analysis logic
- `src/services/incident.service.ts` - Incident management
- `src/services/policy.service.ts` - Policy enforcement

### Protocol Adapters (Keep As-Is)
- `src/utils/mcp-client.ts` - MCP protocol implementation
- `src/utils/letta-client.ts` - Letta integration
- `src/utils/manual-tools.ts` - A2A tool definitions
- `src/utils/scan-website.ts` - Website scanning logic

### External Integrations (Keep As-Is)
- All API calls to external services
- Tool schemas and definitions
- Security analysis algorithms
- Risk scoring logic

---

## ✅ Success Criteria

1. **Code Quality**
   - [ ] All TypeScript strict mode enabled
   - [ ] No `any` types (except external APIs)
   - [ ] Consistent error handling
   - [ ] Structured logging

2. **Maintainability**
   - [ ] Clear separation of concerns
   - [ ] Reusable utility functions
   - [ ] Well-documented code
   - [ ] Easy to test

3. **Functionality**
   - [ ] All existing features work
   - [ ] No breaking changes to APIs
   - [ ] Security logic unchanged
   - [ ] Performance maintained or improved

---

## 🎯 Next Steps

1. Review this plan
2. Start with Phase 1 (Foundation)
3. Test after each phase
4. Document changes
5. Deploy incrementally

---

**Last Updated:** December 3, 2024
