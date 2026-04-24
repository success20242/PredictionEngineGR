import dotenv from "dotenv";
dotenv.config(); // MUST be first

import express from "express";
import cors from "cors";
import { callGemini } from "./services/geminiService.js";

// ⚽ NEW: Sportmonks service
import {
  getLiveScores,
  getFixtures,
  getStandings,
} from "./services/sportmonksService.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ======================
// TEST ROUTE
// ======================
app.get("/", (req, res) => {
  res.json({ status: "Server running" });
});

// ======================
// PUBLIC SETTINGS ROUTE (FIX FOR FRONTEND 404)
// ======================
app.get("/api/apps/public-settings/:id", (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Missing app id" });
  }

  return res.json({
    appId: id,
    appName: "Prediction Engine",
    status: "active",
    environment: "development",
  });
});

// ======================
// GEMINI ROUTE (AI ONLY - NOT DATA SOURCE)
// ======================
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

// ======================
// ⚽ SPORTMONKS FOOTBALL API ROUTES
// ======================

// LIVE SCORES
app.get("/api/football/live", async (req, res) => {
  try {
    const data = await getLiveScores();

    res.json({
      success: true,
      matches: data.data || [],
    });
  } catch (err) {
    console.error("Live API error:", err.message);
    res.status(500).json({ error: "Failed to fetch live matches" });
  }
});

// FIXTURES
app.get("/api/football/fixtures", async (req, res) => {
  try {
    const { date } = req.query;

    const data = await getFixtures(
      date || new Date().toISOString().split("T")[0]
    );

    res.json({
      success: true,
      fixtures: data.data || [],
    });
  } catch (err) {
    console.error("Fixtures API error:", err.message);
    res.status(500).json({ error: "Failed to fetch fixtures" });
  }
});

// STANDINGS
app.get("/api/football/standings", async (req, res) => {
  try {
    const { leagueId } = req.query;

    const data = await getStandings(leagueId || 8);

    res.json({
      success: true,
      standings: data.data || [],
    });
  } catch (err) {
    console.error("Standings API error:", err.message);
    res.status(500).json({ error: "Failed to fetch standings" });
  }
});

// ======================
// START SERVER
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
