// Vercel serverless function entry point
// This file exports the Express app for Vercel deployment
// Vercel will compile this TypeScript file automatically

import app from "../dist/server";

// Export the Express app as a serverless function
export default app;

