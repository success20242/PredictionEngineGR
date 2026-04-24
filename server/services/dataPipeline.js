/**
 * ⚽ DATA PIPELINE LAYER (CLEAN + NORMALIZED)
 */

import {
  scrapeFixtures,
  scrapeStandings,
  scrapeResults,
} from "./fallbackScraper.js";

import {
  getFixtures,
  getStandings,
  getResults,
} from "./footballDataService.js";

import { normalizeMatchData } from "./dataNormalizer.js";

// ==========================
// 🔁 GENERIC FALLBACK WRAPPER
// ==========================
async function getDataWithFallback(primaryFn, fallbackFn) {
  try {
    const data = await primaryFn();

    const hasData =
      data?.data ||
      data?.matches ||
      data?.standings ||
      data?.results;

    if (hasData) {
      return {
        data,
        source: "primary",
      };
    }

    throw new Error("Empty primary response");
  } catch (err) {
    console.warn("⚠️ Primary failed → fallback:", err.message);

    const fallback = await fallbackFn();

    return {
      data: fallback,
      source: "fallback",
    };
  }
}

// ==========================
// ⚽ FIXTURES PIPELINE
// ==========================
export async function getFixturesPipeline(date) {
  const result = await getDataWithFallback(
    () => scrapeFixtures(date),
    () => getFixtures(date)
  );

  const raw = result.data?.matches || result.data || [];

  const normalized = normalizeMatchData(raw);

  return {
    data: {
      fixtures: normalized,
    },
    source: result.source,
  };
}

// ==========================
// 📊 STANDINGS PIPELINE
// ==========================
export async function getStandingsPipeline(leagueId) {
  const result = await getDataWithFallback(
    () => scrapeStandings(leagueId),
    () => getStandings(leagueId)
  );

  const raw = result.data?.standings || result.data || [];

  const normalized = normalizeMatchData(raw);

  return {
    data: {
      standings: normalized,
    },
    source: result.source,
  };
}

// ==========================
// 📈 RESULTS PIPELINE
// ==========================
export async function getResultsPipeline() {
  const result = await getDataWithFallback(
    () => scrapeResults(),
    () => getResults()
  );

  const raw = result.data?.results || result.data?.matches || result.data || [];

  const normalized = normalizeMatchData(raw);

  return {
    data: {
      results: normalized,
    },
    source: result.source,
  };
}
