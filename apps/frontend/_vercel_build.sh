#!/bin/bash
# Vercel build script - copy static files to dist

echo "Building frontend..."

# Create dist directory
mkdir -p dist

# Copy all files to dist
cp index.html dist/
cp -r js dist/ 2>/dev/null || true

echo "✓ Build complete"
