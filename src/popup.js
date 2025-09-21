document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('input');
  const prompt = document.getElementById('prompt');
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
