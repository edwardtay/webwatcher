// Quick test script for Exa MCP integration
import { exaSearch } from './src/utils/mcp-client.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testExa() {
  console.log('Testing Exa MCP integration...');
  console.log('EXA_API_KEY:', process.env.EXA_API_KEY ? 'Set' : 'Not set');
  
  try {
    const results = await exaSearch('cybersecurity vulnerabilities 2025', 3);
    console.log('\n✅ Exa search successful!');
    console.log(`Found ${results.length} results:\n`);
    results.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Snippet: ${result.snippet?.substring(0, 100)}...\n`);
    });
  } catch (error) {
    console.error('❌ Exa search failed:', error.message);
    console.error(error);
  }
}

testExa();


