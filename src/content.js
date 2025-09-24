// content.js - Content script with overlay interface

console.log('LinkedIn Extractor content script loaded');

// Store extracted data globally
let extractedData = {
    name: '',
    headline: '',
    about: '',
    experience: '',
    aiResponse: ''
};

// Function to extract person name
function extractPersonName() {
    try {
        const element = document.querySelector('h1[data-anonymize="person-name"]');
        const personName = element ? element.textContent.trim() : '';
        console.log('Person Name:', personName);
        return personName;
    } catch (error) {
        console.error('Error extracting person name:', error);
        return '';
    }
}

// Function to extract headline
function extractHeadline() {
    try {
        const element = document.querySelector('span[data-anonymize="headline"]');
        const headline = element ? element.textContent.trim() : '';
        console.log('Headline:', headline);
        return headline;
    } catch (error) {
        console.error('Error extracting headline:', error);
        return '';
    }
}

// Function to extract about
function extractAbout() {
    try {
        // Try multiple selectors for different about section formats
        let element = document.querySelector('p[data-anonymize="person-blurb"]');

        // If not found, try div format with line-clamp styling
        if (!element) {
            element = document.querySelector('div[data-anonymize="person-blurb"]');
        }

        if (element) {
            // Handle nested span structures by extracting visible text
            const visibleSpans = element.querySelectorAll('span[style*="display: inline"]');
            if (visibleSpans.length > 0) {
                // Extract text from visible spans
                const about = Array.from(visibleSpans)
                    .map(span => span.textContent.trim())
                    .join(' ');
                console.log('About (from spans):', about);
                return about;
            } else {
                // Fallback to element's text content
                const about = element.textContent.trim();
                console.log('About (from element):', about);
                return about;
            }
        }

        console.log('About: No element found');
        return '';
    } catch (error) {
        console.error('Error extracting about:', error);
        return '';
    }
}

// Function to extract experience data
function extractExperienceData() {
    try {
        const experienceEntries = document.querySelectorAll('li._experience-entry_1irc72');
        console.log('Found experience entries:', experienceEntries.length);
        
        const results = [];
        
        experienceEntries.forEach((entry, index) => {
            try {
                const titleElement = entry.querySelector('h2[data-anonymize="job-title"]');
                const title = titleElement ? titleElement.textContent.trim() : '';
                
                const companyElement = entry.querySelector('p[data-anonymize="company-name"]');
                const company = companyElement ? companyElement.textContent.trim() : '';
                
                // Find date element by looking for span containing date range pattern
                let fromDate = '', toDate = '', duration = '';
                const dateParent = entry.querySelector('p._bodyText_1e5nen._default_1i6ulk._sizeXSmall_1e5nen._lowEmphasis_1i6ulk');

                if (dateParent) {
                    // Look for span containing date range within the date parent
                    const dateSpan = dateParent.querySelector('span');
                    if (dateSpan) {
                        const dateText = dateSpan.textContent.trim();
                        if (dateText.includes('–')) {
                            const [from, to] = dateText.split('–');
                            fromDate = from.trim();
                            toDate = to.trim();
                        } else {
                            fromDate = dateText;
                        }
                    }

                    // Extract duration from the parent paragraph's text content
                    const parentText = dateParent.textContent.trim();
                    // Find duration pattern (numbers followed by yrs/mos/days)
                    const durationMatch = parentText.match(/(\d+\s+(?:yrs?|mos?)(?:\s+\d+\s+(?:yrs?|mos?))*)\s*$/);
                    duration = durationMatch ? durationMatch[1].trim() : '';
                }
                
                const experienceElement = entry.querySelector('p[data-anonymize="person-blurb"]');
                let experience = '';
                if (experienceElement) {
                    const clonedElement = experienceElement.cloneNode(true);
                    const showLessButton = clonedElement.querySelector('button');
                    if (showLessButton) {
                        showLessButton.remove();
                    }
                    experience = clonedElement.textContent.trim()
                        .replace(/\s+/g, ' ')
                        .replace(/\n/g, ' ');
                }
                
                const row = [
                    title.replace(/\t/g, ' '),
                    company.replace(/\t/g, ' '),
                    fromDate.replace(/\t/g, ' '),
                    toDate.replace(/\t/g, ' '),
                    duration.replace(/\t/g, ' '),
                    experience.replace(/\t/g, ' ')
                ].join('\t');
                
                results.push(row);
                
            } catch (error) {
                console.error(`Error processing entry ${index + 1}:`, error);
            }
        });

        var output = results.join('\n');
        
        console.log('Experience:\n' + output);

        return output;
    } catch (error) {
        console.error('Error extracting experience data:', error);
        return '';
    }
}

// Function to click all "Show more" buttons
function clickAllShowMore() {
    try {
        const buttons = document.querySelectorAll('button');
        const showMoreButtons = [];
        
        buttons.forEach(function(button) {
            const showMoreSpan = button.querySelector('span.button-text');
            if (showMoreSpan && showMoreSpan.textContent.trim() === 'Show more') {
                showMoreButtons.push(button);
            }
        });
        
        showMoreButtons.forEach(function(button, index) {
            setTimeout(function() {
                try {
                    button.click();
                    console.log('Clicked Show more button', index + 1);
                } catch (error) {
                    console.error('Error clicking button:', error);
                }
            }, index * 500);
        });
        
        console.log('Found and clicking', showMoreButtons.length, 'Show more buttons');
        return showMoreButtons.length;
    } catch (error) {
        console.error('Error in clickAllShowMore:', error);
        return 0;
    }
}

// Create floating overlay interface
function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'linkedin-extractor-overlay';
    overlay.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            background: white;
            border: 2px solid #0073b1;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-height: 80vh;
            overflow: hidden;
        ">
            <div style="
                background: #0073b1;
                color: white;
                padding: 10px 15px;
                font-weight: bold;
                border-radius: 6px 6px 0 0;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
            " id="overlay-header">
                <span>Claude LinkedIn Extractor</span>
                <span id="close-overlay" style="cursor: pointer; font-size: 18px;">&times;</span>
            </div>

            <!-- Tab Navigation -->
            <div style="
                display: flex;
                background: #f0f8ff;
                border-bottom: 1px solid #ddd;
            ">
                <button id="main-tab" class="tab-btn active" style="
                    flex: 1;
                    padding: 10px;
                    border: none;
                    background: #0073b1;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: bold;
                ">Extract & Analyze</button>
                <button id="debug-tab" class="tab-btn" style="
                    flex: 1;
                    padding: 10px;
                    border: none;
                    background: #f0f8ff;
                    color: #0073b1;
                    cursor: pointer;
                    font-size: 12px;
                ">Debug Data</button>
            </div>

            <!-- Main Tab Content -->
            <div id="main-content" class="tab-content" style="padding: 15px;">
                <button id="grab-btn" style="
                    width: 100%;
                    background: #0073b1;
                    color: white;
                    border: none;
                    padding: 10px;
                    border-radius: 4px;
                    font-size: 14px;
                    cursor: pointer;
                    margin-bottom: 10px;
                ">Extract & Analyze</button>

                <div id="status" style="
                    margin: 10px 0;
                    padding: 8px;
                    background: #f5f5f5;
                    border-radius: 4px;
                    min-height: 20px;
                    font-size: 12px;
                ">Ready to extract</div>

                <div id="response" style="
                    margin: 10px 0;
                    padding: 10px;
                    background: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    max-height: 200px;
                    overflow-y: auto;
                    font-size: 12px;
                    display: none;
                "></div>

                <button id="copy-tsv-btn" style="
                    width: 100%;
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    display: none;
                ">Copy as TSV</button>
            </div>

            <!-- Debug Tab Content -->
            <div id="debug-content" class="tab-content" style="
                padding: 15px;
                display: none;
                max-height: 60vh;
                overflow-y: auto;
            ">
                <div class="debug-section">
                    <h4 style="
                        margin: 0 0 10px 0;
                        color: #0073b1;
                        font-size: 13px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                    " onclick="toggleDebugSection('person-name')">
                        <span id="person-name-toggle" style="margin-right: 5px;">▼</span>
                        Person Name
                    </h4>
                    <div id="person-name-content" class="debug-content" style="
                        margin-bottom: 15px;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 11px;
                        border-left: 3px solid #0073b1;
                    "></div>
                </div>

                <div class="debug-section">
                    <h4 style="
                        margin: 0 0 10px 0;
                        color: #0073b1;
                        font-size: 13px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                    " onclick="toggleDebugSection('headline')">
                        <span id="headline-toggle" style="margin-right: 5px;">▼</span>
                        Headline
                    </h4>
                    <div id="headline-content" class="debug-content" style="
                        margin-bottom: 15px;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 11px;
                        border-left: 3px solid #0073b1;
                    "></div>
                </div>

                <div class="debug-section">
                    <h4 style="
                        margin: 0 0 10px 0;
                        color: #0073b1;
                        font-size: 13px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                    " onclick="toggleDebugSection('about')">
                        <span id="about-toggle" style="margin-right: 5px;">▼</span>
                        About
                    </h4>
                    <div id="about-content" class="debug-content" style="
                        margin-bottom: 15px;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 11px;
                        border-left: 3px solid #0073b1;
                        max-height: 120px;
                        overflow-y: auto;
                    "></div>
                </div>

                <div class="debug-section">
                    <h4 style="
                        margin: 0 0 10px 0;
                        color: #0073b1;
                        font-size: 13px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                    " onclick="toggleDebugSection('experience')">
                        <span id="experience-toggle" style="margin-right: 5px;">▼</span>
                        Experience
                    </h4>
                    <div id="experience-content" class="debug-content" style="
                        margin-bottom: 15px;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 11px;
                        border-left: 3px solid #0073b1;
                        max-height: 150px;
                        overflow-y: auto;
                    "></div>
                </div>

                <div class="debug-section">
                    <h4 style="
                        margin: 0 0 10px 0;
                        color: #0073b1;
                        font-size: 13px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                    " onclick="toggleDebugSection('prompts')">
                        <span id="prompts-toggle" style="margin-right: 5px;">▼</span>
                        System & User Prompts
                    </h4>
                    <div id="prompts-content" class="debug-content" style="
                        margin-bottom: 15px;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 11px;
                        border-left: 3px solid #0073b1;
                        max-height: 120px;
                        overflow-y: auto;
                    "></div>
                </div>

                <div class="debug-section">
                    <h4 style="
                        margin: 0 0 10px 0;
                        color: #0073b1;
                        font-size: 13px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                    " onclick="toggleDebugSection('ai-result')">
                        <span id="ai-result-toggle" style="margin-right: 5px;">▼</span>
                        AI Result
                    </h4>
                    <div id="ai-result-content" class="debug-content" style="
                        margin-bottom: 15px;
                        padding: 8px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        font-family: monospace;
                        font-size: 11px;
                        border-left: 3px solid #0073b1;
                        max-height: 150px;
                        overflow-y: auto;
                    "></div>
                </div>

                <!-- Copy Debug Data Button -->
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
                    <button id="copy-debug-btn" style="
                        width: 100%;
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 10px;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                        font-weight: bold;
                    ">📋 Copy All Debug Data</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Make draggable
    makeDraggable(overlay.querySelector('#overlay-header'), overlay);
    
    // Add event listeners
    document.getElementById('close-overlay').addEventListener('click', () => {
        overlay.remove();
    });

    document.getElementById('grab-btn').addEventListener('click', handleGrabClick);
    document.getElementById('copy-tsv-btn').addEventListener('click', copyAsLSV);

    // Tab switching
    document.getElementById('main-tab').addEventListener('click', () => switchTab('main'));
    document.getElementById('debug-tab').addEventListener('click', () => switchTab('debug'));

    // Debug copy button
    document.getElementById('copy-debug-btn').addEventListener('click', copyDebugData);
    
    return overlay;
}

// Tab switching functionality
function switchTab(tabName) {
    const mainTab = document.getElementById('main-tab');
    const debugTab = document.getElementById('debug-tab');
    const mainContent = document.getElementById('main-content');
    const debugContent = document.getElementById('debug-content');

    if (tabName === 'main') {
        mainTab.style.background = '#0073b1';
        mainTab.style.color = 'white';
        mainTab.style.fontWeight = 'bold';
        debugTab.style.background = '#f0f8ff';
        debugTab.style.color = '#0073b1';
        debugTab.style.fontWeight = 'normal';
        mainContent.style.display = 'block';
        debugContent.style.display = 'none';
    } else {
        debugTab.style.background = '#0073b1';
        debugTab.style.color = 'white';
        debugTab.style.fontWeight = 'bold';
        mainTab.style.background = '#f0f8ff';
        mainTab.style.color = '#0073b1';
        mainTab.style.fontWeight = 'normal';
        debugContent.style.display = 'block';
        mainContent.style.display = 'none';
    }
}

// Toggle debug sections
function toggleDebugSection(sectionName) {
    const content = document.getElementById(`${sectionName}-content`);
    const toggle = document.getElementById(`${sectionName}-toggle`);

    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        content.style.display = 'none';
        toggle.textContent = '►';
    }
}

// Update debug data in the debug tab
function updateDebugData() {
    const data = extractedData;

    // Update person name
    document.getElementById('person-name-content').textContent =
        data.name || 'No data extracted';

    // Update headline
    document.getElementById('headline-content').textContent =
        data.headline || 'No data extracted';

    // Update about
    document.getElementById('about-content').textContent =
        data.about || 'No data extracted';

    // Update experience
    document.getElementById('experience-content').textContent =
        data.experience || 'No data extracted';

    // Update prompts (system and user)
    const promptsContent = document.getElementById('prompts-content');
    promptsContent.innerHTML = '';

    if (data.systemPrompt) {
        const systemDiv = document.createElement('div');
        systemDiv.style.marginBottom = '10px';
        systemDiv.innerHTML = `<strong style="color: #0073b1;">System Prompt:</strong><br>${data.systemPrompt}`;
        promptsContent.appendChild(systemDiv);
    }

    if (data.userPrompt) {
        const userDiv = document.createElement('div');
        userDiv.innerHTML = `<strong style="color: #0073b1;">User Prompt:</strong><br>${data.userPrompt}`;
        promptsContent.appendChild(userDiv);
    }

    if (!data.systemPrompt && !data.userPrompt) {
        promptsContent.textContent = 'No prompts set';
    }

    // Update AI result
    document.getElementById('ai-result-content').textContent =
        data.aiResponse || 'No AI response yet';
}

// Format AI response from JSON to readable HTML
function formatAIResponse(rawResponse) {
    try {
        let jsonText = rawResponse.trim();

        // Remove markdown code block formatting if present
        if (jsonText.startsWith('```json') && jsonText.endsWith('```')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```') && jsonText.endsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Try to parse as JSON
        const parsed = JSON.parse(jsonText.trim());

        if (parsed.score !== undefined && parsed.category && parsed.rationale) {
            // Determine retirement color based on status
            const retiredValue = parsed.retired || 'Not specified';
            let retiredColor = '#333'; // default

            if (retiredValue === 'Active' || retiredValue.toLowerCase().includes('active')) {
                retiredColor = '#28a745'; // GREEN
            } else if (retiredValue === 'Unknown' || retiredValue === 'Not specified') {
                retiredColor = '#6c757d'; // GRAY
            } else {
                // Parse retirement date to calculate years
                const currentYear = new Date().getFullYear();
                const retiredYear = parseInt(retiredValue.split(' ')[1]) || currentYear;
                const yearsSinceRetired = currentYear - retiredYear;

                if (yearsSinceRetired <= 2) {
                    retiredColor = '#28a745'; // GREEN (0-2 years)
                } else if (yearsSinceRetired <= 5) {
                    retiredColor = '#fd7e14'; // ORANGE (2-5 years)
                } else {
                    retiredColor = '#dc3545'; // RED (5+ years)
                }
            }

            let html = `<div style="line-height: 1.4;">
                <div style="display: flex; margin-bottom: 8px;">
                    <div style="flex: 1; margin-right: 10px;"><strong>Score:</strong> ${parsed.score}</div>
                    <div style="flex: 1; color: ${retiredColor};"><strong>Retired:</strong> ${retiredValue}</div>
                </div>
                <div style="margin-bottom: 8px;"><strong>Category:</strong> ${parsed.category}</div>
                <div style="margin-bottom: 8px;"><strong>Rationale:</strong> ${parsed.rationale}</div>`;

            if (parsed.promptSuggestion) {
                html += `<div style="margin-top: 12px; padding: 8px; background: #e3f2fd; border-left: 3px solid #2196f3; border-radius: 4px;">
                    <div style="font-weight: bold; color: #1976d2; margin-bottom: 4px;">💡 Prompt Improvement:</div>
                    <div style="font-size: 11px;">${parsed.promptSuggestion}</div>
                </div>`;
            }

            html += `</div>`;
            return html;
        }
    } catch (e) {
        // If JSON parsing fails, fall back to original format
        console.log('Failed to parse JSON response, displaying as text:', e);
    }

    // Fallback to original text display
    return rawResponse;
}

// Copy all debug data to clipboard
async function copyDebugData() {
    const data = extractedData;
    const copyBtn = document.getElementById('copy-debug-btn');
    const originalText = copyBtn.textContent;

    try {
        const debugText = `=== LINKEDIN PROFILE DEBUG DATA ===

PERSON NAME:
${data.name || 'No data extracted'}

HEADLINE:
${data.headline || 'No data extracted'}

ABOUT:
${data.about || 'No data extracted'}

EXPERIENCE:
${data.experience || 'No data extracted'}

SYSTEM PROMPT:
${data.systemPrompt || 'No system prompt available'}

USER PROMPT:
${data.userPrompt || 'No user prompt available'}

AI RESPONSE:
${data.aiResponse || 'No AI response yet'}

=== END DEBUG DATA ===`;

        await navigator.clipboard.writeText(debugText);

        // Visual feedback
        copyBtn.textContent = '✅ Copied!';
        copyBtn.style.background = '#28a745';

        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '#28a745';
        }, 2000);

    } catch (error) {
        console.error('Copy failed:', error);
        copyBtn.textContent = '❌ Copy failed';
        copyBtn.style.background = '#dc3545';

        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '#28a745';
        }, 2000);
    }
}

// Make toggleDebugSection globally available
window.toggleDebugSection = toggleDebugSection;

// Make overlay draggable
function makeDraggable(header, overlay) {
    let isDragging = false;
    let currentX, currentY, initialX, initialY;
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        initialX = e.clientX - overlay.offsetLeft;
        initialY = e.clientY - overlay.offsetTop;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            overlay.style.left = currentX + 'px';
            overlay.style.top = currentY + 'px';
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

// Handle grab button click
async function handleGrabClick() {
    const grabBtn = document.getElementById('grab-btn');
    const status = document.getElementById('status');
    const response = document.getElementById('response');
    const copyBtn = document.getElementById('copy-tsv-btn');
    
    try {
        grabBtn.disabled = true;
        grabBtn.textContent = 'Processing...';
        status.textContent = 'Clicking "Show more" buttons...';
        
        // Click show more buttons
        const showMoreCount = clickAllShowMore();
        
        // Wait for content to load
        const waitTime = Math.max(showMoreCount * 500 + 2000, 3000);
        status.textContent = `Waiting ${Math.ceil(waitTime/1000)}s for content to load...`;
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Extract data
        status.textContent = 'Extracting LinkedIn data...';
        extractedData.name = extractPersonName();
        extractedData.headline = extractHeadline();
        extractedData.about = extractAbout();
        extractedData.experience = extractExperienceData();

        // Update debug data display
        updateDebugData();
        
        // Send extraction data to background for API processing
        status.textContent = 'Sending to API...';
        chrome.runtime.sendMessage({
            action: 'processWithAPI',
            data: {
                name: extractedData.name,
                headline: extractedData.headline,
                about: extractedData.about,
                experience: extractedData.experience
            }
        }, (apiResponse) => {
            if (chrome.runtime.lastError) {
                status.textContent = 'Error: ' + chrome.runtime.lastError.message;
                return;
            }
            
            if (apiResponse.success) {
                extractedData.aiResponse = apiResponse.aiResponse;
                extractedData.systemPrompt = apiResponse.systemPrompt;
                extractedData.userPrompt = apiResponse.userPrompt;

                status.textContent = 'Analysis complete!';
                status.style.background = '#d4edda';
                status.style.color = '#155724';

                // Flash success and then hide status after 3 seconds
                setTimeout(() => {
                    status.style.transition = 'opacity 0.5s ease-out';
                    status.style.opacity = '0';
                    setTimeout(() => {
                        status.style.display = 'none';
                    }, 500);
                }, 2500);

                response.innerHTML = formatAIResponse(extractedData.aiResponse);
                response.style.display = 'block';
                copyBtn.style.display = 'block';

                // Update debug data display with all information including prompts
                updateDebugData();
            } else {
                status.textContent = 'API Error: ' + apiResponse.error;
            }
        });
        
    } catch (error) {
        status.textContent = 'Error: ' + error.message;
        console.error('Extraction Error:', error);
    } finally {
        grabBtn.disabled = false;
        grabBtn.textContent = 'Extract & Analyze';
    }
}

// Copy data as TSV
async function copyAsLSV() {
    const currentUrl = window.location.href;
    
    // Clean AI response for TSV: remove markdown formatting and replace line breaks with spaces
    const cleanAiResponse = extractedData.aiResponse
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold** formatting for TSV
        .replace(/\n/g, ' ')              // Replace line breaks with spaces
        .replace(/\s+/g, ' ')             // Replace multiple spaces with single space
        .trim();
    
    const tsvData = `Name\tLinkedIn\tHeadline\tAbout\tExperience\tAI\n${extractedData.name}\t${currentUrl}\t${extractedData.headline}\t${extractedData.about}\t${extractedData.experience.replace(/\n/g, ' ')}\t${cleanAiResponse}`;
    
    try {
        await navigator.clipboard.writeText(tsvData);
        const copyBtn = document.getElementById('copy-tsv-btn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    } catch (error) {
        console.error('Copy failed:', error);
        alert('Copy failed: ' + error.message);
    }
}

// Create overlay when page loads
setTimeout(() => {
    if (!document.getElementById('linkedin-extractor-overlay')) {
        createOverlay();
    }
}, 2000);

// Also create global object for manual testing
window.linkedinExtractor = {
    extractPersonName,
    extractHeadline,
    extractAbout,
    extractExperienceData,
    clickAllShowMore,
    showOverlay: createOverlay
};

// Debug: Log what elements are found on page load
// setTimeout(() => {
//     console.log('=== DEBUG INFO ===');
//     console.log('Person name elements:', document.querySelectorAll('h1[data-anonymize="person-name"]').length);
//     console.log('Headline elements:', document.querySelectorAll('h1[data-anonymize="headline"]').length);
//     console.log('Alternative headline elements:', document.querySelectorAll('.text-heading-xlarge').length);
//     console.log('About elements (div):', document.querySelectorAll('div[data-anonymize="person-blurb"]').length);
//     console.log('About elements (any):', document.querySelectorAll('[data-anonymize="person-blurb"]').length);
//     console.log('Experience entries:', document.querySelectorAll('li._experience-entry_1irc72').length);
//     console.log('Show more buttons:', document.querySelectorAll('span.button-text').length);
    
//     // Test extractions
//     console.log('--- TEST EXTRACTIONS ---');
//     console.log('Name test:', extractPersonName());
//     console.log('Headline test:', extractHeadline());
//     console.log('About test:', extractAbout());
//     console.log('==================');
// }, 2000);