#!/bin/bash
# Pre-push checklist script
# Run this before pushing to GitHub

set -e

echo "🔍 Running pre-push checks..."
echo ""

ERRORS=0
WARNINGS=0

# 1. Check for private folder files in git
echo "1. Checking private/ folder..."
if git ls-files | grep -q "^private/"; then
    echo "   ❌ ERROR: Files in private/ are tracked in git!"
    echo "   Files: $(git ls-files | grep '^private/')"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ PASS: No private/ files tracked"
fi

# 2. Check for sensitive files
echo ""
echo "2. Checking for sensitive files..."
SENSITIVE=$(git ls-files | grep -E "\.env$|secret|key|credential|password" | grep -v ".example" || true)
if [ -n "$SENSITIVE" ]; then
    echo "   ❌ ERROR: Sensitive files tracked!"
    echo "$SENSITIVE"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ PASS: No sensitive files tracked"
fi

# 3. Check .cursor folder
echo ""
echo "3. Checking .cursor folder..."
if git ls-files | grep -q "\.cursor"; then
    echo "   ❌ ERROR: .cursor folder is tracked!"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ PASS: .cursor not tracked"
fi

# 4. Check for hardcoded ports
echo ""
echo "4. Checking for hardcoded ports..."
HARDCODED=$(grep -r "3000\|8080" src/ frontend/ --include="*.ts" --include="*.js" --include="*.html" 2>/dev/null | grep -v "process.env.PORT" | grep -v "env.PORT" | grep -v "PORT=" | grep -v "localhost:3000" | grep -v "localhost:8080" | grep -v "//" || true)
if [ -n "$HARDCODED" ]; then
    echo "   ⚠️  WARNING: Possible hardcoded ports found:"
    echo "$HARDCODED" | head -3
    WARNINGS=$((WARNINGS + 1))
else
    echo "   ✅ PASS: No hardcoded ports"
fi

# 5. Check frontend importing backend
echo ""
echo "5. Checking frontend imports..."
FRONTEND_IMPORTS=$(grep -r "from.*src\|import.*src\|require.*src" frontend/ 2>/dev/null || true)
if [ -n "$FRONTEND_IMPORTS" ]; then
    echo "   ❌ ERROR: Frontend imports backend code!"
    echo "$FRONTEND_IMPORTS"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ PASS: Frontend doesn't import backend"
fi

# 6. Check for mocks/simulations
echo ""
echo "6. Checking for mocks/simulations..."
MOCKS=$(grep -ri "mock\|simulate\|fake\|stub" src/ --include="*.ts" 2>/dev/null | grep -v "test" | grep -v "Mock" | grep -v "//" || true)
if [ -n "$MOCKS" ]; then
    echo "   ⚠️  WARNING: Possible mocks found:"
    echo "$MOCKS" | head -3
    WARNINGS=$((WARNINGS + 1))
else
    echo "   ✅ PASS: No mocks/simulations"
fi

# 7. Check build
echo ""
echo "7. Checking TypeScript build..."
if npm run build > /dev/null 2>&1; then
    echo "   ✅ PASS: Build successful"
else
    echo "   ❌ ERROR: Build failed!"
    ERRORS=$((ERRORS + 1))
fi

# 8. Check .md files (should only have essential ones)
echo ""
echo "8. Checking .md files..."
MD_FILES=$(git ls-files | grep "\.md$" | grep -v "README.md\|DEMO_SHOWCASE.md\|HACKATHON_SUBMISSION.md" || true)
if [ -n "$MD_FILES" ]; then
    echo "   ⚠️  WARNING: Extra .md files found (should be in /private):"
    echo "$MD_FILES"
    WARNINGS=$((WARNINGS + 1))
else
    echo "   ✅ PASS: Only essential .md files"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY:"
echo "   Errors: $ERRORS"
echo "   Warnings: $WARNINGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo "❌ FAILED: Fix errors before pushing!"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo "⚠️  WARNINGS: Review warnings before pushing"
    exit 0
else
    echo "✅ ALL CHECKS PASSED: Safe to push!"
    exit 0
fi

