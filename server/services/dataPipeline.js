/**
 * ⚽ DATA PIPELINE LAYER (SCRAPER FIRST SYSTEM)
 * - Scraper PRIMARY
 * - football-data.org fallback
 * - Normalized output for prediction engine
 */

import {
  getFixtures,
  getStandings
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
      return {
        data,
        source: "football-data.org"
      };
    }

    throw new Error("Primary empty");
  } catch (err) {
    console.warn("⚠️ Primary failed → scraper activated");

    const fallback = await fallbackFn();

    return {
      data: fallback,
      source: "scraper"
    };
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
// 📊 STANDINGS PIPELINE (NORMALIZED)
// ==========================
export async function getStandingsPipeline(leagueId) {
  const result = await getDataWithFallback(
    () => getStandings(leagueId),
    scrapeStandings
  );

  // ✅ SAFETY CHECK 1: Extract raw data from various sources
  const raw =
    result.data?.standings ||     // Already normalized from footballDataService
    result.data?.matches ||
    result.data?.results ||
    result.data ||
    [];

  // ✅ SAFETY CHECK 2: Skip normalization if already normalized
  const normalized = (Array.isArray(raw) && raw.length > 0 && raw[0].team)
    ? raw  // Already has normalized .team field
    : normalizeMatchData(raw);

  return {
    data: {
      standings: normalized
    },
    source: result.source
  };
}

// ==========================
// 📈 RESULTS PIPELINE (SCRAPER ONLY + NORMALIZED)
// ==========================
export async function getResultsPipeline() {
  const result = await getDataWithFallback(
    scrapeResults,   // football-data.org NOT needed for live results
    scrapeResults
  );

  // ✅ SAFETY CHECK 1: Extract raw data from various sources
  const raw =
    result.data?.matches ||
    result.data?.results ||
    result.data ||
    [];

  // ✅ SAFETY CHECK 2: Skip normalization if already normalized
  const normalized = (Array.isArray(raw) && raw.length > 0 && raw[0].team)
    ? raw  // Already has normalized .team field
    : normalizeMatchData(raw);

  return {
    data: {
      results: normalized
    },
    source: result.source
  };
}
