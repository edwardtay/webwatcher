# A2A v0.2.6 Spec Compliance Fix

## Problem
WebWatcher's A2A endpoint was requiring a non-standard `skill` parameter in `message/send` requests, breaking compatibility with generic A2A tools like the LLM Auditor.

**Error:** `"Missing required parameter: skill"`

## Root Cause
The implementation added a custom `skill` parameter to `MessageSendParams`, which is not part of the A2A v0.2.6 specification. The spec only defines:
- `message` (required)
- `configuration` (optional)
- `metadata` (optional)

## Solution
Updated the `message/send` handler to:

1. **Accept standard MessageSendParams** - Only `message`, `configuration`, and `metadata`
2. **Read skillId from metadata** - Optional `metadata.skillId` or `metadata.skill`
3. **Auto-route when no skill specified** - Intelligently route based on message content
4. **Match LLM Auditor behavior** - Work with generic A2A tools out of the box

## Changes Made

### 1. Controller (`apps/backend/src/api/controllers/a2a.controller.ts`)
- Removed required `skill` parameter validation
- Added optional skill reading from `metadata.skillId` or `metadata.skill`
- Implemented `autoRouteSkill()` function for intelligent routing
- Extract parameters from both `data` and `text` message parts

### 2. Routes (`apps/backend/src/api/routes/a2a.routes.ts`)
- Updated example to show spec-compliant format with `metadata.skillId`
- Added note that skillId is optional
- Provided both explicit and auto-route curl examples

### 3. Documentation (`A2A_IMPLEMENTATION.md`)
- Updated request/response examples to JSON-RPC 2.0 format
- Clarified that skillId is optional
- Fixed endpoint paths (`/a2a` not `/api/a2a`)
- Added auto-routing examples

## Usage Examples

### With explicit skillId (recommended for specific tools)
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{"kind": "data", "data": {"url": "https://example.com"}}]
    },
    "metadata": {"skillId": "scanUrl"}
  },
  "id": "1"
}
```

### With auto-routing (generic A2A tools)
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{"kind": "data", "data": {"url": "https://example.com"}}]
    }
  },
  "id": "1"
}
```

## Auto-Routing Logic
When no `skillId` is provided, the system routes based on:
1. **Parameter detection** - Presence of `url`, `domain`, or `email` parameters
2. **Text content analysis** - Keywords in text parts (breach, pwned, etc.)
3. **Default fallback** - `scanUrl` as the most common use case

## Compatibility
✅ Now works with generic A2A tools (LLM Auditor, etc.)
✅ Backward compatible with custom clients using `metadata.skillId`
✅ Follows A2A v0.2.6 specification exactly
✅ Matches reference implementations

## Testing
```bash
# Test with generic A2A tool format
curl -X POST http://localhost:8080/a2a \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"data","data":{"url":"https://google.com"}}]}},"id":"1"}'
```
