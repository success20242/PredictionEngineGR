import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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

// GEMINI ROUTE (THIS FIXES YOUR NETWORK ERROR)
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
