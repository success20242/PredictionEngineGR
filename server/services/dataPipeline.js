/**
 * ⚽ DATA PIPELINE LAYER
 * Connects:
 * - Sportmonks API
 * - Fallback Scraper
 * - Prediction Engine (Elo + Poisson input)
 */

import {
  getFixtures,
  getStandings,
  getLiveScores,
} from "./sportmonksService.js";

import {
  scrapeFixtures,
  scrapeStandings,
  scrapeResults,
} from "./fallbackScraper.js";

// ==========================
// 🔁 SMART DATA SOURCE SWITCH
// ==========================
async function getDataWithFallback(fnPrimary, fnFallback) {
  try {
    const data = await fnPrimary();

    if (data && (data.data || data.fixtures || data.standings)) {
      return { data, source: "sportmonks" };
    }

    throw new Error("Primary empty");
  } catch (err) {
    console.warn("⚠️ Sportmonks failed → fallback activated");

    const fallback = await fnFallback();

    return { data: fallback, source: "scraper" };
  }
}

// ==========================
// ⚽ FIXTURES PIPELINE
// ==========================
export async function getFixturesPipeline(date) {
  return getDataWithFallback(
    () => getFixtures(date),
    scrapeFixtures
  );
}

// ==========================
// 📊 STANDINGS PIPELINE
// ==========================
export async function getStandingsPipeline(leagueId) {
  return getDataWithFallback(
    () => getStandings(leagueId),
    scrapeStandings
  );
}

// ==========================
// 📈 RESULTS PIPELINE
// ==========================
export async function getResultsPipeline() {
  return getDataWithFallback(
    () => getLiveScores(),
    scrapeResults
  );
}
