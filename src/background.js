// background.js - Service worker for handling API calls

console.log('Background script loaded');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'processWithAPI') {
    handleAPIProcessing(request.data, sendResponse);
    return true; // Keep message channel open for async response
  }
});

// Handle API processing from content script
async function handleAPIProcessing(extractedData, sendResponse) {
  try {
    console.log('Processing API request with data:', extractedData);
    
    // Get API key from storage
    chrome.storage.sync.get(['claudeApiKey'], async (result) => {
      if (!result.claudeApiKey) {
        console.log('No API key found');
        sendResponse({ success: false, error: 'API key not set. Please configure in extension settings.' });
        return;
      }

      try {
        // Format data same way as original popup
        const combinedData = `${extractedData.name}\n${extractedData.headline}\n${extractedData.about}\n${extractedData.experience}`;
        console.log('Calling API with combined data length:', combinedData.length);
        
        // Call API using the same logic as popup
        const aiResponse = await callAnthropicMessageAPI(result.claudeApiKey, combinedData);
        
        console.log('API call successful, sending response');
        sendResponse({ success: true, aiResponse: aiResponse });
        
      } catch (error) {
        console.error('API call failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
  } catch (error) {
    console.error('Error processing API request:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// API function moved from popup.js
async function callAnthropicMessageAPI(apiKey, profileData) {
  const apiUrl = 'https://api.anthropic.com/v1/messages';

  const systemPrompt = `You are a board composition analyst for a Microsoft consulting services M&A consolidation strategy using Dan Peña's QLA methodology. Focus on seasoned executives with clean records and substantial transaction experience.\nBoard Positions:\n\nChairman - Former CEO with 100+ deals, M&A leadership\nCFO/Financial Strategist - Ex-CFO public tech firm, strategic finance\nFinance & Deal Expert - Investment banking MD, commercial debt experience\nAccounting Expert - Big 4 Partner or Public Controller, consulting experience\nMicrosoft Technology Strategist - Ex-Microsoft executive, D365/Azure/Power Platform\nEnterprise Sales Executive - Microsoft partner sales leader, enterprise experience\nIndustry Practice Leader - Big 4/top-tier consulting MD, broad industry experience\nLegal Expert - Tech M&A attorney, 20+ transactions\n\nKey Criteria:\n\nMust Have: Clean background, senior leadership, relevant M&A/transaction experience\nRed Flags: Background hesitation, equity % focus, condescending attitude, insufficient deals\n\nOutput Format: Confidence Match: 0-100. Best Fit Position: [Position Name and Number]. Reason in Favor: [One sentence - strongest match]. Potential Concern: [One sentence - biggest gap/risk].`;

  const userContent = `Analyze this LinkedIn profile for board position fit:\nLinkedIn Profile:\n[Insert profile details: current/recent roles, experience, achievements, industry focus, transactions, education]\nDetermine best board position match using the output format above.\n`;

  const requestBody = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 64000,
    temperature: 0.7,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userContent + profileData
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('Full API Response received');

    // Extract the actual text content from the response
    if (data.content && data.content[0] && data.content[0].text) {
      const responseText = data.content[0].text;
      console.log('Claude Response length:', responseText.length);
      console.log('Usage Stats:', data.usage);
      
      return responseText;
    } else {
      console.warn('Unexpected response format:', data);
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
    }

  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}