/**
 * ⚽ FOOTBALL-DATA.ORG FALLBACK SERVICE
 * Used ONLY when scraper fails
 */

import axios from "axios";

const API_KEY = process.env.FOOTBALL_DATA_KEY;

const BASE_URL = "https://api.football-data.org/v4";

const headers = {
  "X-Auth-Token": API_KEY,
};

/**
 * 📊 GET STANDINGS
 */
export async function getStandings(leagueCode = "PL") {
  try {
    const res = await axios.get(
      `${BASE_URL}/competitions/${leagueCode}/standings`,
      { headers }
    );

    return {
      source: "football-data",
      standings: res.data.standings?.[0]?.table || [],
    };
  } catch (err) {
    console.error("Football-data standings error:", err.message);
    return { standings: [], source: "football-data-failed" };
  }
}

/**
 * 📅 GET FIXTURES
 */
export async function getFixtures(leagueCode = "PL") {
  try {
    const res = await axios.get(
      `${BASE_URL}/competitions/${leagueCode}/matches`,
      { headers }
    );

    return {
      source: "football-data",
      matches: res.data.matches || [],
    };
  } catch (err) {
    console.error("Football-data fixtures error:", err.message);
    return { matches: [], source: "football-data-failed" };
  }
}

/**
 * 📈 GET RECENT RESULTS
 */
export async function getResults(leagueCode = "PL") {
  try {
    const res = await axios.get(
      `${BASE_URL}/competitions/${leagueCode}/matches?status=FINISHED`,
      { headers }
    );

    return {
      source: "football-data",
      results: res.data.matches || [],
    };
  } catch (err) {
    console.error("Football-data results error:", err.message);
    return { results: [], source: "football-data-failed" };
  }
}
