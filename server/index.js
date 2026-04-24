import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { callGemini } from "./services/geminiService.js";

// ⚽ PRIMARY SCRAPER SYSTEM
import {
  scrapeFixtures,
  scrapeStandings,
  scrapeResults,
  scrapeH2H,
} from "./services/fallbackScraper.js";

// 🥈 FALLBACK API (football-data.org)
import {
  getFixtures,
  getStandings,
  getResults,
} from "./services/footballDataService.js";

// 🧠 PREDICTION PIPELINE
import { getStandingsPipeline } from "./services/dataPipeline.js";
import { buildPredictionInput } from "./services/predictionEngine.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ======================
// HEALTH CHECK
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

  res.json({
    appId: id,
    appName: "Prediction Engine",
    status: "active",
    environment: "development",
  });
});

// ======================
// GEMINI (AI ONLY)
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
// ⚽ FIXTURES (SCRAPER FIRST)
// ======================
app.get("/api/football/fixtures", async (req, res) => {
  try {
    const scraped = await scrapeFixtures();

    if (scraped?.matches?.length > 0) {
      return res.json({
        ...scraped,
        source: "scraper",
      });
    }

    const fallback = await getFixtures("PL");

    res.json({
      ...fallback,
      source: "football-data",
    });

  } catch (err) {
    console.error("Fixtures error:", err.message);

    const fallback = await getFixtures("PL");
    res.json(fallback);
  }
});


// ======================
// 📊 STANDINGS (SCRAPER FIRST)
// ======================
app.get("/api/football/standings", async (req, res) => {
  try {
    const scraped = await scrapeStandings();

    if (scraped?.standings?.length > 0) {
      return res.json({
        ...scraped,
        source: "scraper",
      });
    }

    const fallback = await getStandings("PL");

    res.json({
      ...fallback,
      source: "football-data",
    });

  } catch (err) {
    console.error("Standings error:", err.message);

    const fallback = await getStandings("PL");
    res.json(fallback);
  }
});


// ======================
// 📈 RESULTS (SCRAPER FIRST)
// ======================
app.get("/api/football/results", async (req, res) => {
  try {
    const scraped = await scrapeResults();

    if (scraped?.results?.length > 0) {
      return res.json({
        ...scraped,
        source: "scraper",
      });
    }

    const fallback = await getResults("PL");

    res.json({
      ...fallback,
      source: "football-data",
    });

  } catch (err) {
    console.error("Results error:", err.message);

    const fallback = await getResults("PL");
    res.json(fallback);
  }
});


// ======================
// 🔁 H2H (SCRAPER ONLY)
// ======================
app.get("/api/football/h2h", async (req, res) => {
  try {
    const { home, away } = req.query;

    const data = await scrapeH2H(home, away);

    res.json({
      ...data,
      source: "scraper",
    });

  } catch (err) {
    console.error("H2H error:", err.message);
    res.status(500).json({ error: "H2H failed" });
  }
});


// ======================
// 🧠 PREDICTION INPUT PIPELINE
// ======================
app.get("/api/prediction/input/:leagueId", async (req, res) => {
  try {
    const { leagueId } = req.params;

    const { data } = await getStandingsPipeline(leagueId);

    const teams = data?.standings || data?.data || data;

    const modelInput = buildPredictionInput(teams);

    res.json({
      success: true,
      source: data.source || "hybrid",
      teams: modelInput,
    });

  } catch (err) {
    console.error("Prediction pipeline error:", err.message);
    res.status(500).json({ error: "Prediction input failed" });
  }
});


// ======================
// START SERVER
// ======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
