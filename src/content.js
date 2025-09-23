// content.js - This runs directly on LinkedIn pages

console.log('LinkedIn Extractor content script loaded');

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

// Function to extract headline - FIXED SYNTAX ERROR
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

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    try {
        if (request.action === 'extractAll') {
            console.log('Processing extractAll request...');
            
            // Wait for "show more" clicks to complete, then extract
            const showMoreCount = clickAllShowMore();
            
            // Use longer timeout to ensure all data loads
            const waitTime = Math.max(showMoreCount * 500 + 2000, 3000);
            console.log(`Waiting ${waitTime}ms for content to load...`);
            
            setTimeout(() => {
                try {
                    console.log('Extracting data after wait...');
                    
                    const name = extractPersonName();
                    const headline = extractHeadline();
                    const about = extractAbout();
                    const experience = extractExperienceData();
                    
                    console.log('Extraction complete, sending response...');
                    
                    sendResponse({
                        success: true, 
                        data: {
                            name: name,
                            headline: headline,
                            about: about,
                            experience: experience,
                            showMoreClicked: showMoreCount
                        }
                    });
                } catch (error) {
                    console.error('Error during delayed extraction:', error);
                    sendResponse({success: false, error: error.message});
                }
            }, waitTime);
            
            return true; // Keep message channel open for async response
        } else {
            console.log('Unknown action:', request.action);
            sendResponse({success: false, error: 'Unknown action: ' + request.action});
        }
    } catch (error) {
        console.error('Content script error:', error);
        sendResponse({success: false, error: error.message});
    }
});

// Create global object for manual testing
try {
    window.linkedinExtractor = {
        extractPersonName,
        extractHeadline,
        extractAbout,
        extractExperienceData,
        clickAllShowMore
    };
    console.log('window.linkedinExtractor created successfully');
} catch (error) {
    console.error('Error creating linkedinExtractor object:', error);
}

// Debug: Log what elements are found on page load
setTimeout(() => {
    console.log('=== DEBUG INFO ===');
    console.log('Person name elements:', document.querySelectorAll('h1[data-anonymize="person-name"]').length);
    console.log('Headline elements:', document.querySelectorAll('h1[data-anonymize="headline"]').length);
    console.log('About elements:', document.querySelectorAll('div[data-anonymize="person-blurb"]').length);
    console.log('Experience entries:', document.querySelectorAll('li._experience-entry_1irc72').length);
    console.log('Show more buttons:', document.querySelectorAll('span.button-text').length);
    console.log('==================');
}, 2000);