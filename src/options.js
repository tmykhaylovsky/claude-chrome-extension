document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveButton');
  const messageDiv = document.getElementById('message');

  // Load a saved API key
  chrome.storage.sync.get(['claudeApiKey'], function(result) {
    if (result.claudeApiKey) {
      apiKeyInput.value = result.claudeApiKey;
    }
  });

  // Save button click event
  saveButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showMessage('API please enter the key', 'error');
      return;
    }

    // API save key
    chrome.storage.sync.set({
      claudeApiKey: apiKey
    }, function() {
      showMessage('Settings saved', 'success');
    });
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
  }
});
