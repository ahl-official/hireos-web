const fetch = require('node-fetch');

async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/save-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Test Candidate',
        whatsapp: '9876543210',
        email: 'test@example.com',
        positionApplied: 'AI Developer',
        resume: {
          name: 'test.pdf',
          type: 'application/pdf',
          data: 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPU0FDQy0zPySwuyc/RMNYw1zPQM9Qz1zPRM9Yz1DPQMzTQAAAA//8DAF0iB1wKZW5kc3RyZWFtCmVuZG9iagoKMyAwIG9iago0OQplbmRvYmoKCjUgMCBvYmoKPDwvTGVuZ3RoIDYgMCBSL0ZpbHRlci9GbGF0ZURlY29kZS9MZW5ndGgxIDc1MzI+PgpzdHJlYW0KeJzFOwl...=' // Dummy base64 PDF
        }
      })
    });
    
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (e) {
    console.error('Test script error:', e);
  }
}

run();
