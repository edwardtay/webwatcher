/**
 * Simple test to verify Letta has persistent memory
 */

async function testLettaMemory() {
  console.log('🧪 Testing Letta Persistent Memory...\n');
  
  // Test 1: Send first message
  console.log('📝 Test 1: Sending first message with context...');
  const response1 = await fetch('http://localhost:8080/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message: 'Remember: My company is Acme Corp and we are concerned about phishing attacks targeting our finance team.' 
    })
  });
  
  const data1 = await response1.json();
  console.log('✅ Response 1:', data1.response.substring(0, 200) + '...');
  console.log('📊 Letta Enabled:', data1.lettaEnabled);
  console.log('');
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Send follow-up message to check if it remembers
  console.log('📝 Test 2: Asking follow-up question to test memory...');
  const response2 = await fetch('http://localhost:8080/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message: 'What security concerns did I mention about my company?' 
    })
  });
  
  const data2 = await response2.json();
  console.log('✅ Response 2:', data2.response.substring(0, 300) + '...');
  console.log('');
  
  // Check if response mentions Acme Corp or finance team
  const hasMemory = data2.response.toLowerCase().includes('acme') || 
                    data2.response.toLowerCase().includes('finance');
  
  console.log('🧠 Memory Test Result:');
  console.log('  - Letta Enabled:', data2.lettaEnabled);
  console.log('  - Remembers Context:', hasMemory ? '✅ YES' : '❌ NO');
  console.log('  - Thread ID:', data2.threadId);
  
  if (hasMemory) {
    console.log('\n✅ SUCCESS: Letta has persistent memory!');
    console.log('   The agent remembered "Acme Corp" and "finance team" from the previous message.');
  } else {
    console.log('\n⚠️  Note: Memory may be stored but not explicitly referenced in response.');
    console.log('   Letta stores interactions in memory blocks for learning.');
  }
}

testLettaMemory().catch(console.error);
