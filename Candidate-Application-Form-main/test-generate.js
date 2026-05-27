require('dotenv').config();
const fetch = require('node-fetch');

async function testGenerate() {
  const appsScriptUrl = process.env.VITE_GOOGLE_APP_SCRIPT_URL;
  if (!appsScriptUrl) {
    console.error("No VITE_GOOGLE_APP_SCRIPT_URL found in .env");
    return;
  }

  console.log("Calling Webhook to generate questions...");
  try {
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generateCandidateTest',
        role: 'AI Engineer',
        name: 'Tanmay Patil',
        resumeText: 'Experienced AI Engineer with 5 years in Python, Machine Learning, TensorFlow, and building Generative AI applications using LLMs.'
      })
    });
    
    const data = await res.json();
    console.log("Webhook Response:", JSON.stringify(data, null, 2));
    
    if (data.id) {
      // Let's try to fetch it back
      console.log("Fetching the generated interview...");
      const getRes = await fetch(`${appsScriptUrl}?action=getInterview&interviewId=${data.id}`);
      const getJson = await getRes.json();
      console.log("Interview Data:", JSON.stringify(getJson, null, 2));
    }
    
  } catch (err) {
    console.error("Error:", err);
  }
}

testGenerate();
