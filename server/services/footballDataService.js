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
 * 📊 GET STANDINGS - WITH SAFETY CHECKS & NORMALIZATION
 */
export async function getStandings(leagueCode = "PL") {
  try {
    const res = await axios.get(
      `${BASE_URL}/competitions/${leagueCode}/standings`,
      { headers }
    );

    // ✅ SAFETY CHECK 1: Validate response structure
    if (!res.data?.standings?.[0]?.table || !Array.isArray(res.data.standings[0].table)) {
      console.warn("⚠️ Invalid standings response structure");
      return { standings: [], source: "football-data-failed" };
    }

    // ✅ SAFETY CHECK 2: Map and normalize each entry
    const normalized = res.data.standings[0].table
      .map((entry) => {
        // Guard against undefined or missing team data
        if (!entry || typeof entry !== 'object') {
          console.warn("⚠️ Invalid entry skipped:", entry);
          return null;
        }

        // Handle nested team object - CRITICAL FIX
        const teamName = entry.team?.name || entry.Team?.name || "Unknown";
        
        if (!teamName || teamName === "Unknown") {
          console.warn("⚠️ Entry missing team name:", entry);
          return null;
        }

        return {
          team: teamName,
          position: entry.position || 0,
          played: entry.playedGames || 0,
          wins: entry.won || 0,
          draws: entry.draw || 0,
          losses: entry.lost || 0,
          goals_for: entry.goalsFor || 0,
          goals_against: entry.goalsAgainst || 0,
          points: entry.points || 0,
          goal_difference: entry.goalDifference || 0,
          form: entry.form ? entry.form.split(",").map(f => f.trim()) : [],
          recent_form: entry.form || "",
          elo_rating: 1500,
        };
      })
      .filter(team => team !== null); // ✅ Remove nulls

    if (normalized.length === 0) {
      console.warn("⚠️ No valid standings after normalization");
      return { standings: [], source: "football-data-failed" };
    }

    return {
      source: "football-data",
      standings: normalized,
    };
  } catch (err) {
    console.error("❌ Football-data standings error:", err.message);
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
    console.error("❌ Football-data fixtures error:", err.message);
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
    console.error("❌ Football-data results error:", err.message);
    return { results: [], source: "football-data-failed" };
  }
}
