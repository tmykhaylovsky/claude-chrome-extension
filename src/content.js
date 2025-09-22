// content.js - This runs directly on LinkedIn pages

console.log('LinkedIn Extractor content script loaded');

// Function to extract person name
function extractPersonName() {
    const element = document.querySelector('h1[data-anonymize="person-name"]');
    const personName = element ? element.textContent.trim() : '';
    console.log('Person Name:', personName);
    return personName;
}

// Function to extract headline
function extractHeadline() {
    const element = document.querySelector('h1[data-anonymize="headline"]"]');
    const headline = element ? element.textContent.trim() : '';
    console.log('Headline:', headline);
    return headline;
}

// Function to extract about
function extractAbout() {
    const element = document.querySelector('div[data-anonymize="person-blurb"]');
    const about = element ? element.getAttribute('title').trim() : '';
    console.log('About:', about);
    return about;
}

// Function to extract experience data (your previous function)
function extractExperienceData() {
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
}

// Function to click all "Show more" buttons
function clickAllShowMore() {
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
            button.click();
            console.log('Clicked Show more button', index + 1);
        }, index * 500);
    });
    
    console.log('Found and clicking', showMoreButtons.length, 'Show more buttons');
    return showMoreButtons.length;
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    try {
        if (request.action === 'extractName') {
            const name = extractPersonName();
            sendResponse({success: true, data: name});
            
        } else if (request.action === 'extractExperience') {
            const experience = extractExperienceData();
            sendResponse({success: true, data: experience});
            
        } else if (request.action === 'clickShowMore') {
            const count = clickAllShowMore();
            sendResponse({success: true, data: count});
            
        } else if (request.action === 'extractAll') {
            // Wait for "show more" clicks to complete, then extract
            const showMoreCount = clickAllShowMore();
            
            setTimeout(() => {
                const name = extractPersonName();
                const headline = extractHeadline();
                const about = extractAbout();
                const experience = extractExperienceData();
                
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
            }, showMoreCount * 500 + 1000); // Wait for all clicks plus buffer
            
            return true; // Keep message channel open for async response
        }
    } catch (error) {
        console.error('Content script error:', error);
        sendResponse({success: false, error: error.message});
    }
});

// Auto-run on page load (optional)
window.addEventListener('load', () => {
    console.log('LinkedIn page loaded, extracting name...');
    extractPersonName();
});

// For manual testing in console
window.linkedinExtractor = {
    extractPersonName,
    extractExperienceData,
    clickAllShowMore
};