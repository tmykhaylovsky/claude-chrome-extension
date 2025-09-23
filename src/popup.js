// Helper function to get current tab - MOVED TO TOP
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  return tab;
}

// Send message to content script - MOVED TO TOP
async function sendMessageToContent(action, data = {}) {
  try {
    const tab = await getCurrentTab();

    if (!tab.url.includes('linkedin.com')) {
      throw new Error('Please navigate to a LinkedIn profile page');
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action, ...data }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processWithAPI') {
    handleAPIProcessing(request.data, sendResponse);
    return true; // Keep message channel open for async response
  }
});

// Handle API processing from content script
async function handleAPIProcessing(extractedData, sendResponse) {
  try {
    // Get API key
    chrome.storage.sync.get(['claudeApiKey'], async (result) => {
      if (!result.claudeApiKey) {
        sendResponse({ success: false, error: 'API key not set. Please configure in extension settings.' });
        return;
      }

      try {
        // Format data same way as original popup
        const combinedData = `${extractedData.name}\n${extractedData.headline}\n${extractedData.about}\n${extractedData.experience}`;
        
        // Call API using existing function and prompts
        const aiResponse = await callAnthropicMessageAPI(result.claudeApiKey, combinedData);
        
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

document.addEventListener('DOMContentLoaded', function () {
  const input = document.getElementById('input');
  const prompt = document.getElementById('prompt');
  const grabButton = document.getElementById('grabButton');
  const sendButton = document.getElementById('sendButton');
  const copyButton = document.getElementById('copyButton');
  const settingsButton = document.getElementById('settingsButton');
  const loading = document.getElementById('loading');
  const response = document.getElementById('response');
  const languageSelect = document.getElementById('language');
  const temperatureSelect = document.getElementById('temperature');

  // Settings button event listener
  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Copy button event listener
  copyButton.addEventListener('click', async () => {
    const text = response.textContent;
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = 'Copy completed!';
      setTimeout(() => {
        copyButton.textContent = 'copy results';
      }, 2000);
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      copyButton.textContent = 'Copy failure';
      setTimeout(() => {
        copyButton.textContent = 'copy results';
      }, 2000);
    }
  });

  // Load settings
  chrome.storage.sync.get(['language', 'temperature', 'defaultPrompt'], function (result) {
    if (result.language) {
      languageSelect.value = result.language;
    }
    if (result.temperature) {
      temperatureSelect.value = result.temperature;
    }
    if (result.defaultPrompt) {
      prompt.value = result.defaultPrompt;
    }
  });

  // Save configuration changes
  languageSelect.addEventListener('change', function () {
    chrome.storage.sync.set({ language: languageSelect.value });
  });

  temperatureSelect.addEventListener('change', function () {
    chrome.storage.sync.set({ temperature: temperatureSelect.value });
  });

  // Save prompt changes
  prompt.addEventListener('change', function () {
    chrome.storage.sync.set({ defaultPrompt: prompt.value });
  });

  // Get selected text from the page
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    try {
      const [tab] = tabs;
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });

      if (result[0].result) {
        input.value = result[0].result;
      }
    } catch (error) {
      console.error('text selection error:', error);
    }
  });

  grabButton.addEventListener('click', async () => {
    console.log('Grab button clicked');
    
    try {
      // Show loading state immediately
      grabButton.disabled = true;
      loading.style.display = 'block';
      response.textContent = 'Extracting LinkedIn data...';

      const extractResponse = await sendMessageToContent('extractAll');
      console.log('Extract response:', extractResponse);
      
      var personName = '', headline = '', about = '', tsvExperienceData = '';
      if (extractResponse.success) {
        personName = extractResponse.data.name;
        headline = extractResponse.data.headline;
        about = extractResponse.data.about;
        tsvExperienceData = extractResponse.data.experience;
        
        response.textContent = 'Data extracted, calling API...';
      } else {
        throw new Error('Failed to extract LinkedIn data: ' + (extractResponse.error || 'Unknown error'));
      }
      
      var combinedData = `${personName}\n${headline}\n${about}\n${tsvExperienceData}`;
      console.log('Combined data length:', combinedData.length);

      // API get key
      chrome.storage.sync.get(['claudeApiKey'], async function (result) {
        if (!result.claudeApiKey) {
          response.textContent = 'API key is not set. Please set it in the extension settings.';
          return;
        }

        try {
          await callAnthropicMessageAPI(result.claudeApiKey, combinedData);
        } catch (error) {
          response.textContent = `An error has occurred: ${error.message}`;
        } finally {
          grabButton.disabled = false;
          loading.style.display = 'none';
        }
      });
      
    } catch (error) {
      console.error('Grab button error:', error);
      response.textContent = `Error: ${error.message}`;
      grabButton.disabled = false;
      loading.style.display = 'none';
    }
  });
});

async function callAnthropicMessageAPI(apiKey, profileData) {
  const apiUrl = 'https://api.anthropic.com/v1/messages';

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
    console.log('Full API Response:', data);

    // Extract the actual text content from the response
    if (data.content && data.content[0] && data.content[0].text) {
      const responseText = data.content[0].text;
      console.log('Claude Response:', responseText);
      console.log('Usage Stats:', data.usage);

      // Only update DOM if elements exist (for popup usage)
      const responseElement = document.getElementById('response');
      const copyButton = document.getElementById('copyButton');
      if (responseElement && copyButton) {
        responseElement.textContent = responseText;
        copyButton.disabled = false;
      }
      
      // Return the response text for content script usage
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

const systemPrompt = `You are a board composition analyst for a Microsoft consulting services M&A consolidation strategy using Dan Peña's QLA methodology. Focus on seasoned executives with clean records and substantial transaction experience.\nBoard Positions:\n\nChairman - Former CEO with 100+ deals, M&A leadership\nCFO/Financial Strategist - Ex-CFO public tech firm, strategic finance\nFinance & Deal Expert - Investment banking MD, commercial debt experience\nAccounting Expert - Big 4 Partner or Public Controller, consulting experience\nMicrosoft Technology Strategist - Ex-Microsoft executive, D365/Azure/Power Platform\nEnterprise Sales Executive - Microsoft partner sales leader, enterprise experience\nIndustry Practice Leader - Big 4/top-tier consulting MD, broad industry experience\nLegal Expert - Tech M&A attorney, 20+ transactions\n\nKey Criteria:\n\nMust Have: Clean background, senior leadership, relevant M&A/transaction experience\nRed Flags: Background hesitation, equity % focus, condescending attitude, insufficient deals\n\nOutput Format:\nBest Fit Position: [Position Name and Number]\nReason in Favor: [One sentence - strongest match]\nPotential Concern: [One sentence - biggest gap/risk]`;

const userContent = `Analyze this LinkedIn profile for board position fit:\nLinkedIn Profile:\n[Insert profile details: current/recent roles, experience, achievements, industry focus, transactions, education]\nDetermine best board position match using the output format above.\n`;
