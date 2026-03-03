# Xolver

A Chrome extension that solves questions on web pages using Google Gemini AI. Select any question element on a page and get an instant answer.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![Gemini AI](https://img.shields.io/badge/Powered%20by-Gemini%20AI-purple)

## Features

- **Element Selector** — Click on any question element on a page to solve it instantly
- **Auto-Solve** — Automatically detects and solves all questions on supported quiz pages
- **Custom Site Config** — Define custom CSS selectors per site for precise question detection
- **Shadow DOM & iframe Support** — Works on complex pages like Netacad with nested iframes
- **Short Answer Mode** — Get concise answers without explanations
- **Free API Mode** — Rate limiting for free Gemini API tier
- **Keyboard Shortcut** — Press `Alt+S` to toggle element selection mode
- **Pinnable Window** — Detach the popup into a persistent floating window

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder
5. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
6. Open the extension, go to Settings, and paste your API key

## Project Structure

```
Xolver/
├── src/
│   ├── background.js     # Service worker — Gemini API calls & chat storage
│   ├── content.js        # Injected into pages — element selector & auto-solve logic
│   ├── content.css       # Styles injected into pages
│   ├── popup.html        # Extension popup UI
│   ├── popup.js          # Popup logic
│   └── popup.css         # Popup styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── manifest.json
└── README.md
```

## Usage

### Manual Question Solving
1. Open the extension popup
2. Click **Element Seç** (or press `Alt+S`)
3. Click on a question element on the page
4. Xolver sends the question to Gemini and displays the answer

### Auto-Solve
1. Configure custom CSS selectors for the site under **Site Config**
2. Click **Otomatik Çöz**
3. Xolver detects all questions and solves them sequentially

### Custom Site Config
Navigate to the **Site Config** tab in the popup and enter CSS selectors for:
- **Question container** — the element wrapping each question
- **Answer options** — each clickable option element
- **Option input** — the radio/checkbox input inside each option

## Configuration

| Setting | Description |
|---|---|
| API Key | Your Google Gemini API key |
| Model | Gemini model to use (Flash, Pro, etc.) |
| Short Answer Mode | Returns only the answer letter, no explanation |
| Free API Mode | Adds delays between requests to avoid quota errors |

## Requirements

- Google Chrome (Manifest V3)
- A [Gemini API key](https://aistudio.google.com/app/apikey) (free tier available)

## License

MIT
