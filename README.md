# KeyChecker

KeyChecker is a lightweight local web tool for validating **OpenRouter API keys** and checking whether a key can successfully run a selected model.

## What it does

- Accepts an OpenRouter API key in the browser
- Lets you choose from common model IDs (or provide a custom model ID)
- Sends a test prompt to OpenRouter's chat completions API
- Shows success/failure, response content, latency, and token usage
- Stores recent test history in browser `localStorage`

## How it works

This repository contains two files:

- `index.html`: complete frontend UI + JavaScript logic
- `server.js`: tiny Node.js static file server used for local development

When you click **Run Validation**, the browser makes a direct request to:

- `https://openrouter.ai/api/v1/chat/completions`

using your entered API key in the `Authorization: Bearer ...` header.

## Privacy & security

- Your API key is entered and used in the browser runtime.
- The included `server.js` is only a static file server and does **not** proxy or process API requests.
- No backend in this repo stores your key.

Even so, API keys are sensitive credentials. Treat them like passwords and avoid using shared/untrusted machines.

## Quick start (local)

1. Clone this repository:

   ```bash
   git clone https://github.com/K0OOL/KeyChecker.git
   cd KeyChecker
   ```

2. Start the local server (default port is `3737`):

   ```bash
   node server.js [port]
   ```

   Example:

   ```bash
   node server.js 3737
   ```

3. Open in your browser:

   - `http://localhost:3737` (or the custom port you passed)

