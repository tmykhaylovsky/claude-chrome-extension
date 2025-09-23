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
        const element = document.querySelector('h1[data-anonymize="headline"]');
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
        const element = document.querySelector('div[data-anonymize="person-blurb"]');
        const about = element ? element.getAttribute('title').trim() : '';
        console.log('About:', about);
        return about;
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
        
        const header = 'Title\tCompany\tFrom\tTo\tTotal\tExperience';
        const results = [header];
        
        experienceEntries.forEach((entry, index) => {
            try {
                const titleElement = entry.querySelector('h2[data-anonymize="job-title"]');
                const title = titleElement ? titleElement.textContent.trim() : '';
                
                const companyElement = entry.querySelector('p[data-anonymize="company-name"]');
                const company = companyElement ? companyElement.textContent.trim() : '';
                
                const dateElement = entry.querySelector('span.zZBAOYLmEFjcDfsYUmIEzHtLjzlKDENIg');
                let fromDate = '', toDate = '', duration = '';
                
                if (dateElement) {
                    const dateText = dateElement.textContent.trim();
                    if (dateText.includes('–')) {
                        const [from, to] = dateText.split('–');
                        fromDate = from.trim();
                        toDate = to.trim();
                    }
                    
                    const durationParent = dateElement.closest('p');
                    if (durationParent) {
                        const durationMatch = durationParent.textContent.match(/(\d+\s+(?:yrs?|mos?|days?)(?:\s+\d+\s+(?:yrs?|mos?|days?))*)/);
                        duration = durationMatch ? durationMatch[1].trim() : '';
                    }
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
        
        return results.join('\n');
    } catch (error) {
        console.error('Error extracting experience data:', error);
        return 'Title\tCompany\tFrom\tTo\tTotal\tExperience';
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
            width: 350px;
            background: white;
            border: 2px solid #0073b1;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 14px;
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
            <div style="padding: 15px;">
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
    
    return overlay;
}

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
        
        // Send extraction data to popup for API processing
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
                status.textContent = 'Analysis complete!';
                response.textContent = extractedData.aiResponse;
                response.style.display = 'block';
                copyBtn.style.display = 'block';
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
    const tsvData = `Name\tLinkedIn\tHeadline\tAbout\tExperience\tAI\n${extractedData.name}\t${currentUrl}\t${extractedData.headline}\t${extractedData.about}\t${extractedData.experience.replace(/\n/g, ' ')}\t${extractedData.aiResponse}`;
    
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