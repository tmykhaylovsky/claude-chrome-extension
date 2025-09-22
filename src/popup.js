document.addEventListener('DOMContentLoaded', function() {
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
  chrome.storage.sync.get(['language', 'temperature', 'defaultPrompt'], function(result) {
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
  languageSelect.addEventListener('change', function() {
    chrome.storage.sync.set({ language: languageSelect.value });
  });

  temperatureSelect.addEventListener('change', function() {
    chrome.storage.sync.set({ temperature: temperatureSelect.value });
  });

  // Save prompt changes
  prompt.addEventListener('change', function() {
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
    // name
    var element = document.querySelector('h1[data-anonymize="person-name"]');
    var personName = element ? element.textContent.trim() : '';
    console.log(personName);

    // headline
    element = document.querySelector('h1[data-anonymize="headline"]');
    var headline = element ? element.textContent.trim() : '';
    console.log(headline);

    // person blurb | about
    element = document.querySelector('div[data-anonymize="person-blurb"]');
    var about = element ? element.getAttribute('title') : '';
    console.log(about);

    // expand all positions
    // Target buttons that contain spans with "Show more" text
    var buttons = document.querySelectorAll('button');
    buttons.forEach(function(button) {
        var showMoreSpan = button.querySelector('span.button-text');
        if (showMoreSpan && showMoreSpan.textContent.trim() === 'Show more') {
            button.click();
        }
    });

    // extract experience data
    const tsvExperienceData = extractExperienceData();
    console.log(tsvExperienceData);

    var combinedData = `${personName}\n${headline}\n${about}\n${tsvExperienceData}`;

    // API get key
    chrome.storage.sync.get(['claudeApiKey'], async function(result) {
      if (!result.claudeApiKey) {
        response.textContent = 'API The key is not set. Please set it in the extension settings.';
        return;
      }

      try {
        grabButton.disabled = true;
        loading.style.display = 'block';
        response.textContent = '';

        //await streamClaudeAPI(combinedData, result.claudeApiKey, response);
        debugger;
        await callAnthropicAPI(result.claudeApiKey, combinedData);
      } catch (error) {
        response.textContent = `An error has occurred: ${error.message}`;
      } finally {
        grabButton.disabled = false;
        loading.style.display = 'none';
      }
    });

  });

  sendButton.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) {
      response.textContent = 'Please enter the input text.';
      return;
    }

    // API get key
    chrome.storage.sync.get(['claudeApiKey'], async function(result) {
      if (!result.claudeApiKey) {
        response.textContent = 'API The key is not set. Please set it in the extension settings.';
        return;
      }

      try {
        sendButton.disabled = true;
        loading.style.display = 'block';
        response.textContent = '';

        await streamClaudeAPI(text, result.claudeApiKey, response);
      } catch (error) {
        response.textContent = `An error has occurred: ${error.message}`;
      } finally {
        sendButton.disabled = false;
        loading.style.display = 'none';
      }
    });
  });
});

async function streamClaudeAPI(text, apiKey, responseElement) {
  try {
    // Combining prompts with user input
    const promptText = document.getElementById('prompt').value.trim();
    const systemPrompt = getSystemPrompt(document.getElementById('language').value);
    const temperature = parseFloat(document.getElementById('temperature').value);

    // Prepare your message
    const messages = [];
    
    if (promptText) {
      messages.push({
        role: 'user',
        content: promptText
      });
    }

    messages.push({
      role: 'user',
      content: text
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-4-sonnet-20250514',
        max_tokens: 64000,
        temperature: temperature,
        system: systemPrompt,
        messages: messages,
        stream: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              responseElement.textContent += parsed.delta.text;
              copyButton.disabled = false;
            }
          } catch (e) {
            console.error('Failed to parse SSE message:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}



function getSystemPrompt(language) {
  const prompts = {
    en: `You are a helpful AI assistant.
Please follow these principles:
- Use clear and concise English
- Use bullet points when appropriate
- Explain technical terms properly
- Indicate when answers are uncertain`
  };
  return prompts[language] || prompts.ja;
}

function extractExperienceData() {
    // Select all experience entries
    const experienceEntries = document.querySelectorAll('li._experience-entry_1irc72');
    
    // Header row
    const header = 'Title\tCompany\tFrom\tTo\tTotal\tExperience';
    console.log(header);
    
    const results = [header];
    
    experienceEntries.forEach((entry, index) => {
        try {
            // Extract job title
            const titleElement = entry.querySelector('h2[data-anonymize="job-title"]');
            const title = titleElement ? titleElement.textContent.trim() : '';
            
            // Extract company name
            const companyElement = entry.querySelector('p[data-anonymize="company-name"]');
            const company = companyElement ? companyElement.textContent.trim() : '';
            
            // Extract date range and duration
            const dateElement = entry.querySelector('span.zZBAOYLmEFjcDfsYUmIEzHtLjzlKDENIg');
            let fromDate = '', toDate = '', duration = '';
            
            if (dateElement) {
                const dateText = dateElement.textContent.trim();
                // Parse date range (e.g., "Jan 2010–Present" or "Jan 2011–Mar 2011")
                if (dateText.includes('–')) {
                    const [from, to] = dateText.split('–');
                    fromDate = from.trim();
                    toDate = to.trim();
                }
                
                // Get duration from the parent paragraph
                const durationParent = dateElement.closest('p');
                if (durationParent) {
                    const durationMatch = durationParent.textContent.match(/(\d+\s+(?:yrs?|mos?|days?)(?:\s+\d+\s+(?:yrs?|mos?|days?))*)/);
                    duration = durationMatch ? durationMatch[1].trim() : '';
                }
            }
            
            // Extract experience description
            const experienceElement = entry.querySelector('p[data-anonymize="person-blurb"]');
            let experience = '';
            if (experienceElement) {
                // Get text content but remove the "Show less" button text
                const clonedElement = experienceElement.cloneNode(true);
                const showLessButton = clonedElement.querySelector('button');
                if (showLessButton) {
                    showLessButton.remove();
                }
                experience = clonedElement.textContent.trim()
                    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
                    .replace(/\n/g, ' ');  // Replace newlines with spaces
            }
            
            // Create tab-separated row
            const row = [
                title.replace(/\t/g, ' '),      // Replace tabs in data with spaces
                company.replace(/\t/g, ' '),
                fromDate.replace(/\t/g, ' '),
                toDate.replace(/\t/g, ' '),
                duration.replace(/\t/g, ' '),
                experience.replace(/\t/g, ' ')
            ].join('\t');
            
            //console.log(row);
            results.push(row);
            
        } catch (error) {
            console.error(`Error processing entry ${index + 1}:`, error);
        }
    });
    
    return results.join('\n');
}

async function callAnthropicAPI(apiKey, profileData) {
    const apiUrl = 'https://api.anthropic.com/v1/messages';
    
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

- - -

${profileData}`;

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
                        text: userContent
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
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });

        debugger;
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        // const data = await response.json();
        // console.log('API Response:', data);
        // return data;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  responseElement.textContent += parsed.delta.text;
                  copyButton.disabled = false;
                }
              } catch (e) {
                console.error('Failed to parse SSE message:', e);
              }
            }
          }
        }
    } catch (error) {
        console.error('Error calling Anthropic API:', error);
        throw error;
    }
}
