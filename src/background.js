// background.js - Service worker for handling API calls

console.log('Background script loaded');

// Prompts defined at module level for access by multiple functions
const SYSTEM_PROMPT =
`You are a board composition analyst applying Dan Peña's QLA framework for Microsoft consulting services M&A boards.
BOARD ROLES:
- Chairman: CEO/Chairman, 100+ deals, M&A leadership
- CFO/Financial Strategist: Ex-CFO of public tech firm
- Finance & Deal Expert: Investment banking Managing Director, debt experience
- Accounting Expert: Big 4 Partner or Controller
- Microsoft Technology Strategist: Ex-Microsoft exec (D365/Azure/Power Platform)
- Enterprise Sales Exec: Microsoft partner sales leader
- Industry Practice Leader: Big 4/top consulting Managing Director
- Legal Expert: Tech M&A attorney, 20+ deals
- None: insufficient info or health issues → score 0
SCORING:
- Baseline: 80 for fully qualified candidate
- Retirement weighting (applied strictly to final score):
   * Retiring <6 months: +10
   * Retired 0–1 yrs: +8
   * Retired 1–2 yrs: +6
   * Retired >2 yrs: subtract 5 points per extra year
   * - If Category = None → no score shown
- Cap 0–100
OUTPUT FORMAT:
Return your response as valid JSON in this exact format:
{
  "score": 85,
  "category": "Microsoft Technology Strategist",
  "retired": "June 2018",
  "rationale": "Strong technology transformation and systems integration background with ERP/digitization experience, though lacks direct Microsoft platform expertise for optimal consulting services M&A board contribution.",
  "promptSuggestion": "Consider adding criteria for adjacent technology leadership (ERP/digitization) that could translate to Microsoft consulting value. Current prompt may be too narrow on direct Microsoft experience."
}

RETIREMENT DATE FORMAT:
- Use "Month YYYY" format (e.g., "June 2018", "December 2020")
- If person is still in an executive role or retiring soon: "Active"
- If retirement date unclear but clearly retired: "Unknown"

PROMPT IMPROVEMENT GUIDANCE:
- For scores 0-40: Focus on identifying overlooked qualifications or transferable experience that could raise the score significantly
- For scores 40-70: Suggest refinements to scoring criteria that might better capture this person's unique value
- For scores 70+: Recommend ways to distinguish truly exceptional candidates from good ones
- For "None" categories: Identify if missing information could reveal hidden potential worth 60+ points
`;

const USER_PROMPT_TEMPLATE =
`Analyze this LinkedIn profile.
1. Identify retirement status: Find the END DATE of their last major executive role (CEO, CFO, President, etc.). Board positions, advisory roles, or consulting after this date do NOT reset the retirement clock.
2. Calculate years retired from that last major executive role end date to today (2024).
3. Apply retirement weighting exactly (-5 per year beyond 2 years from executive role).
4. Start from baseline 80, adjust, cap 0–100.
5. If insufficient info or health concerns → None, score 0.
Return ONLY valid JSON with score, category, retired, rationale, and promptSuggestion fields.
PROFILE:
`;

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
        sendResponse({
          success: true,
          aiResponse: aiResponse,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: USER_PROMPT_TEMPLATE.split('PROFILE:')[0].trim()
        });
        
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

  const systemPrompt = SYSTEM_PROMPT;

  const userContent = USER_PROMPT_TEMPLATE;

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