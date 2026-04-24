import dotenv from "dotenv";
dotenv.config(); // MUST be first

import express from "express";
import cors from "cors";
import { callGemini } from "./services/geminiService.js";

// ⚽ Sportmonks service (PRIMARY)
import {
  getLiveScores,
  getFixtures,
  getStandings,
} from "./services/sportmonksService.js";

// 🧠 Fallback scraper (BACKUP)
import {
  scrapeFixtures,
  scrapeStandings,
  scrapeResults,
  scrapeH2H,
} from "./services/fallbackScraper.js";

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
// PUBLIC SETTINGS ROUTE
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
// GEMINI ROUTE (AI ONLY)
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
// ⚽ LIVE MATCHES
// ======================
app.get("/api/football/live", async (req, res) => {
  try {
    const data = await getLiveScores();

    if (!data?.data?.length) {
      console.warn("⚠️ Live fallback triggered");
      const fallback = await scrapeResults();
      return res.json(fallback);
    }

    res.json({
      success: true,
      matches: data.data,
      source: "sportmonks",
    });
  } catch (err) {
    console.warn("Live API failed → fallback:", err.message);

    const fallback = await scrapeResults();
    res.json({ ...fallback, source: "scraper" });
  }
});

// ======================
// 📅 FIXTURES
// ======================
app.get("/api/football/fixtures", async (req, res) => {
  try {
    const { date } = req.query;

    const data = await getFixtures(
      date || new Date().toISOString().split("T")[0]
    );

    if (!data?.data?.length) {
      console.warn("⚠️ Fixtures fallback triggered");
      const fallback = await scrapeFixtures();
      return res.json({ ...fallback, source: "scraper" });
    }

    res.json({
      success: true,
      matches: data.data,
      source: "sportmonks",
    });
  } catch (err) {
    console.warn("Fixtures API failed → fallback:", err.message);

    const fallback = await scrapeFixtures();
    res.json({ ...fallback, source: "scraper" });
  }
});

// ======================
// 📊 STANDINGS
// ======================
app.get("/api/football/standings", async (req, res) => {
  try {
    const { leagueId } = req.query;

    const data = await getStandings(leagueId || 8);

    if (!data?.data?.length) {
      console.warn("⚠️ Standings fallback triggered");
      const fallback = await scrapeStandings();
      return res.json({ ...fallback, source: "scraper" });
    }

    res.json({
      success: true,
      standings: data.data,
      source: "sportmonks",
    });
  } catch (err) {
    console.warn("Standings API failed → fallback:", err.message);

    const fallback = await scrapeStandings();
    res.json({ ...fallback, source: "scraper" });
  }
});

// ======================
// 📈 RESULTS
// ======================
app.get("/api/football/results", async (req, res) => {
  try {
    const data = await getLiveScores();

    if (!data?.data?.length) {
      const fallback = await scrapeResults();
      return res.json({ ...fallback, source: "scraper" });
    }

    res.json({
      success: true,
      results: data.data,
      source: "sportmonks",
    });
  } catch (err) {
    const fallback = await scrapeResults();
    res.json({ ...fallback, source: "scraper" });
  }
});

// ======================
// 🔁 H2H
// ======================
app.get("/api/football/h2h", async (req, res) => {
  try {
    const { home, away } = req.query;

    // ⚠️ Sportmonks H2H requires team IDs (skipping → fallback directly)
    const fallback = await scrapeH2H(home, away);

    res.json({ ...fallback, source: "scraper" });
  } catch (err) {
    console.error("H2H error:", err.message);

    const fallback = await scrapeH2H(req.query.home, req.query.away);
    res.json({ ...fallback, source: "scraper" });
  }
});

// ======================
// START SERVER
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
