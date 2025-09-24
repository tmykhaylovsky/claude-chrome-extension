# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension that integrates Claude AI with LinkedIn Sales Navigator. The extension extracts profile data from LinkedIn Sales Navigator pages and sends it to Claude for AI analysis and processing.

## Architecture

**Chrome Extension Structure:**
- Manifest V3 extension with service worker architecture
- Content script runs only on `*://*.linkedin.com/sales/lead/*` pages
- Background script handles Claude API communication
- Popup interface for manual interaction and settings

**Key Components:**
- `background.js` - Service worker that handles Claude API calls via `callAnthropicMessageAPI()`
- `content.js` - Content script that extracts LinkedIn profile data (name, headline, about, experience) and creates overlay UI
- `popup.js` - Popup interface with settings and manual processing capabilities
- `options.js/options.html` - Extension settings page for API key configuration
- `manifest.json` - Extension configuration with LinkedIn-specific permissions

## Development Workflow

**Installation & Testing:**
1. Load extension in Chrome via "Load unpacked" pointing to `src/` directory
2. Test on LinkedIn Sales Navigator profile pages (`linkedin.com/sales/lead/*`)
3. Configure API key through extension settings (gear icon or right-click options)

**No Build Process:**
- Direct JavaScript files, no compilation or bundling required
- Changes in `src/` directory are reflected after extension reload in Chrome

**API Integration:**
- Uses Anthropic Claude API with streaming responses
- API key stored in Chrome extension sync storage
- Error handling for missing API keys and failed requests

## Key Data Flow

1. Content script extracts profile data from LinkedIn DOM elements
2. Data sent to background script via Chrome messaging API
3. Background script formats data and calls Claude API
4. Response streamed back through content script to overlay UI
5. Popup provides alternative manual interface for same functionality

## Extension Permissions

- `activeTab` - Access to current LinkedIn tab
- `scripting` - Inject content scripts
- `storage` - Store API keys and settings
- `https://api.anthropic.com/*` - Claude API access