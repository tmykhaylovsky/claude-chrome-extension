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

  const systemPrompt =
`Evaluate the following LinkedIn profile for board position suitability. Extract retirement signals carefully (gap from last executive role, current board-only positions, "retired" mentions, age indicators).
PROFILE TO ANALYZE:
[Paste complete LinkedIn profile including:

Current status/headline
Recent roles with dates
Transaction/deal history
Industry expertise
Educational background
Board memberships
Any retirement indicators]

REQUIRED: Identify retirement status first, then determine optimal board position match using the specified output format with match score.`;

  const userContent =
`Evaluate the following LinkedIn profile for board position suitability. Extract retirement signals carefully (gap from last executive role, current board-only positions, \"retired\" mentions, age indicators).
PROFILE TO ANALYZE:
[Paste complete LinkedIn profile including:

Current status/headline
Recent roles with dates
Transaction/deal history
Industry expertise
Educational background
Board memberships
Any retirement indicators]

REQUIRED: Identify retirement status first, then determine optimal board position match using the specified output format with match score.

`;

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