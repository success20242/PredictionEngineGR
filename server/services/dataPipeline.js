/**
 * ⚽ DATA PIPELINE LAYER (SCRAPER FIRST SYSTEM)
 * - Scraper PRIMARY
 * - football-data.org fallback
 * - Normalized output for prediction engine
 */

import {
  getFixtures,
  getStandings,
  getLiveScores,
} from "./footballDataService.js";

import {
  scrapeFixtures,
  scrapeStandings,
  scrapeResults,
} from "./fallbackScraper.js";

import { normalizeMatchData } from "./dataNormalizer.js";

// ==========================
// 🔁 FALLBACK WRAPPER
// ==========================
async function getDataWithFallback(primaryFn, fallbackFn) {
  try {
    const data = await primaryFn();

    const hasData =
      Array.isArray(data) ||
      data?.matches?.length ||
      data?.standings?.length ||
      data?.results?.length;

    if (hasData) {
      return { data, source: "football-data.org" };
    }

    throw new Error("Primary empty");
  } catch (err) {
    console.warn("⚠️ Primary failed → scraper activated");

    const fallback = await fallbackFn();

    return { data: fallback, source: "scraper" };
  }
}

// ==========================
// ⚽ FIXTURES
// ==========================
export async function getFixturesPipeline(date) {
  return getDataWithFallback(
    () => getFixtures(date),
    scrapeFixtures
  );
}

// ==========================
// 📊 STANDINGS + NORMALIZATION (IMPORTANT)
// ==========================
export async function getStandingsPipeline(leagueId) {
  const result = await getDataWithFallback(
    () => getStandings(leagueId),
    scrapeStandings
  );

  const raw =
    result.data?.matches ||
    result.data?.results ||
    result.data?.standings ||
    result.data ||
    [];

  const normalized = normalizeMatchData(raw);

  return {
    data: {
      standings: normalized
    },
    source: result.source
  };
}

// ==========================
// 📈 RESULTS + NORMALIZATION
// ==========================
export async function getResultsPipeline() {
  const result = await getDataWithFallback(
    () => getLiveScores(),
    scrapeResults
  );

  const raw =
    result.data?.matches ||
    result.data?.results ||
    result.data ||
    [];

  const normalized = normalizeMatchData(raw);

  return {
    data: {
      results: normalized
    },
    source: result.source
  };
}
