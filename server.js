// server.js
import express from 'express';
import fetch from 'node-fetch'; // node 18+ has global fetch but using node-fetch for compatibility
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Serve static frontend (index.html + script.js + style.css)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '/')));

// Allowed models (from your account)
const ALLOWED_MODELS = new Set([
  "models/gemini-2.5-flash",
  "models/gemini-2.5-pro",
  "models/gemini-2.0-flash",
  "models/gemini-2.0-flash-001",
  "models/gemini-2.0-flash-lite",
  "models/gemini-2.5-flash-lite"
]);

const GEMINI_KEY = process.env.GEMINI_KEY;

if(!GEMINI_KEY){
  console.warn('WARNING: GEMINI_KEY not defined in environment.');
}

// API endpoint
app.post('/api/generate', async (req, res) => {
  try{
    const { prompt, model } = req.body;
    if(!prompt || typeof prompt !== 'string'){
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const modelName = (typeof model === 'string' && ALLOWED_MODELS.has(model)) ? model : "models/gemini-2.5-flash";

    if(!GEMINI_KEY){
      return res.status(500).json({ error: 'Server misconfigured: GEMINI_KEY missing' });
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GEMINI_KEY}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        // server-side fine to set
        temperature: 0.7,
        maxOutputTokens: 512
      }
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const txt = await r.text();
    if(!r.ok){
      // forward error details
      return res.status(r.status).send(txt);
    }

    const j = JSON.parse(txt);
    const generated = j?.candidates?.[0]?.content?.parts?.[0]?.text
                   || j?.candidates?.[0]?.content?.[0]?.text
                   || j?.output?.text
                   || (typeof j === 'string' ? j : JSON.stringify(j));

    return res.json({ text: generated, raw: j });
  }catch(err){
    console.error('Server error', err);
    res.status(500).json({ error: String(err) });
  }
});

// fallback: serve index for any other route (single page app)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));