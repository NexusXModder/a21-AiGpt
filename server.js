import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));   // Serve frontend files

// 🔥 FIXED: Correct Gemini URL (NO double models/)
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, model } = req.body;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_KEY}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await response.text(); // read raw
    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      return res.status(500).json({
        error: "Google returned invalid JSON",
        raw: text
      });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

// Render port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));