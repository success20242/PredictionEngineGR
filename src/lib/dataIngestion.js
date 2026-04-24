/**
 * ⚽ DATA INGESTION ENGINE (REBUILT)
 * - Scraper FIRST (BBC / Sky / ESPN via backend)
 * - football-data.org fallback via backend
 * - NO Sportmonks
 * - NO LLM data fetching
 */

import { apiClient } from '@/api/apiClient';

// ======================
// LEAGUES
// ======================
export const SUPPORTED_LEAGUES = [
  { name: 'Premier League', country: 'England', short: 'EPL', avg_goals: 2.82 },
  { name: 'La Liga', country: 'Spain', short: 'LaLiga', avg_goals: 2.58 },
  { name: 'Serie A', country: 'Italy', short: 'SerieA', avg_goals: 2.72 },
  { name: 'Bundesliga', country: 'Germany', short: 'Bundesliga', avg_goals: 3.16 },
  { name: 'Ligue 1', country: 'France', short: 'Ligue1', avg_goals: 2.54 },
  { name: 'Champions League', country: 'Europe', short: 'UCL', avg_goals: 2.91 }
];

// ======================
// TEAM NORMALIZATION
// ======================
const TEAM_ALIASES = {
  'man utd': 'Manchester United',
  'man city': 'Manchester City',
  'spurs': 'Tottenham Hotspur',
  'wolves': 'Wolverhampton Wanderers',
  'barca': 'FC Barcelona',
  'real madrid': 'Real Madrid',
  'psg': 'Paris Saint-Germain'
};

export function normalizeTeamName(name) {
  if (!name) return name;
  const lower = name.toLowerCase().trim();
  return TEAM_ALIASES[lower] || name.trim();
}

// ======================
// RELIABILITY SCORE
// ======================
export function calculateReliabilityScore({
  sourcesCount,
  dataFreshness,
  completeness
}) {
  const sourceScore = Math.min(1, sourcesCount / 3);
  const freshnessScore = Math.max(0, 1 - dataFreshness / 60);
  const completenessScore = completeness || 0.7;

  return parseFloat(
    (sourceScore * 0.35 +
      freshnessScore * 0.35 +
      completenessScore * 0.30
    ).toFixed(3)
  );
}

// =====================================================
// ⚽ MAIN DATA FUNCTIONS (NOW BACKEND POWERED)
// =====================================================

/**
 * 📅 FIXTURES
 * Scraper → football-data fallback (backend handles logic)
 */
export async function fetchUpcomingFixtures(leagueName, onProgress) {
  try {
    onProgress?.(`Fetching fixtures for ${leagueName}...`);

    const res = await apiClient.get(
      `/football/fixtures?league=${leagueName}`
    );

    return res;
  } catch (err) {
    console.error("Fixtures fetch failed:", err.message);
    return { matches: [] };
  }
}

/**
 * 📊 STANDINGS
 */
export async function fetchLeagueStandings(leagueName, onProgress) {
  try {
    onProgress?.(`Fetching standings for ${leagueName}...`);

    const res = await apiClient.get(
      `/football/standings?league=${leagueName}`
    );

    return res;
  } catch (err) {
    console.error("Standings fetch failed:", err.message);
    return { standings: [] };
  }
}

/**
 * 📈 RESULTS
 */
export async function fetchRecentResults(leagueName, onProgress) {
  try {
    onProgress?.(`Fetching results for ${leagueName}...`);

    const res = await apiClient.get(
      `/football/results?league=${leagueName}`
    );

    return res;
  } catch (err) {
    console.error("Results fetch failed:", err.message);
    return { results: [] };
  }
}

/**
 * 🔁 H2H
 */
export async function fetchHeadToHead(homeTeam, awayTeam, onProgress) {
  try {
    onProgress?.(`Fetching H2H...`);

    const res = await apiClient.get(
      `/football/h2h?home=${homeTeam}&away=${awayTeam}`
    );

    return res;
  } catch (err) {
    console.error("H2H fetch failed:", err.message);
    return { h2h_matches: [] };
  }
}
