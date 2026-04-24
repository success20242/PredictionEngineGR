import dotenv from "dotenv";
dotenv.config(); // MUST be first

import express from "express";
import cors from "cors";
import { callGemini } from "./services/geminiService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// TEST ROUTE
app.get("/", (req, res) => {
  res.json({ status: "Server running" });
});

// ✅ ADDED: PUBLIC SETTINGS ROUTE (FIX FOR YOUR 404 ERROR)
app.get("/api/apps/public-settings/:id", (req, res) => {
  const { id } = req.params;

  // basic safety check
  if (!id) {
    return res.status(400).json({ error: "Missing app id" });
  }

  // dev-safe response (accept known + unknown ids)
  return res.json({
    appId: id,
    appName: "Prediction Engine",
    status: "active",
    environment: "development"
  });
});

// GEMINI ROUTE
app.post("/api/llm/invoke", async (req, res) => {
  try {
    const { prompt } = req.body;

    const result = await callGemini(prompt);

    res.json(result);
  } catch (err) {
    console.error("LLM Error:", err.message);
    res.status(500).json({ error: "Gemini call failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
