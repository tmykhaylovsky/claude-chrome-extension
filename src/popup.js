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
    const response = await sendMessageToContent('extractAll');
    var personName = '', headline = '', about = '', tsvExperienceData = '';
    if (response.success) {
      personName = response.data.name;
      headline = response.data.headline;
      about = response.data.about;
      tsvExperienceData = response.data.experience;
    } else {
      console.log('extractAll failed');
    }
    
    var combinedData = `${personName}\n${headline}\n${about}\n${tsvExperienceData}`;

    // API get key
    chrome.storage.sync.get(['claudeApiKey'], async function (result) {
      if (!result.claudeApiKey) {
        response.textContent = 'API The key is not set. Please set it in the extension settings.';
        return;
      }

      try {
        grabButton.disabled = true;
        loading.style.display = 'block';
        response.textContent = '';

        debugger;
        await callAnthropicMessageAPI(result.claudeApiKey, combinedData);
      } catch (error) {
        response.textContent = `An error has occurred: ${error.message}`;
      } finally {
        grabButton.disabled = false;
        loading.style.display = 'none';
      }
    });
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

    debugger;
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

      response.textContent = responseText;
      copyButton.disabled = false;
    } else {
      console.warn('Unexpected response format:', data);
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
    }


  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

// Send message to content script
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


const systemPrompt = `You are an expert board composition analyst evaluating LinkedIn profiles against specific board of directors positions for a technology services company focused on M&A growth strategy. Your task is to determine the best fit position for a candidate and provide a concise assessment.

Available Board Positions:

Chairman (4%–6%) - M&A transaction leadership, former CEO/President with M&A experience
CFO/Financial Strategist (3%–5%) - Financial operations, former CFO of public tech consulting firm
Finance & Deal Expert (2%–4%) - Deal sourcing, Managing Director with investment banking experience
Accounting, Audit & Regulatory Expert (2%–3%) - Big 4 Partner or Public Company Controller
Microsoft Technology Strategist (2%–4%) - Former Microsoft Product Executive or CTO
Enterprise Sales & Partnership Executive (2%–3%) - Enterprise sales leader with Microsoft partner experience
Industry Practice Leader (2%–3%) - Managing Director from Big 4 or top-tier consulting firm
Legal & Regulatory Expert (1%–2%) - Technology M&A attorney with 20+ transactions

Evaluation Criteria:

Match candidate's core experience to role requirements
Assess leadership level and seniority
Consider industry relevance and expertise depth
Evaluate transaction/M&A experience where applicable

Output Format:

Best Fit Position: [Position Name and Number]
Reason in Favor: [One brief sentence explaining the strongest match]
Potential Concern: [One brief sentence about the biggest gap or concern]`;

const userContent = `LinkedIn Profile Summary:
[Insert candidate's LinkedIn profile information including current/recent roles, experience, education, and key achievements - see at the bottom of this prompt]

Analysis Request:
Based on the provided LinkedIn profile, determine which of the 8 board positions (#1-8) this candidate would be the best fit for. Provide your assessment following the specified output format with exactly one brief sentence each for the reason in favor and potential concern.

`;
