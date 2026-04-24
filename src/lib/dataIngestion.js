/**
 * DATA INGESTION ENGINE
 * Fetches football data via Sportmonks (primary)
 * with LLM fallback for reasoning only.
 * Normalizes team names, validates data, assigns reliability scores.
 */

import { apiClient } from '@/api/apiClient';

/**
 * ⚽ SPORTMONKS CONFIG
 */
const SPORTMONKS_KEY =
  process.env.SPORTMONKS_KEY || process.env.VITE_SPORTMONKS_KEY;

const sportmonksBase =
  "https://api.sportmonks.com/api/v3/football";

/**
 * 🏆 SUPPORTED LEAGUES
 */
export const SUPPORTED_LEAGUES = [
  { name: 'Premier League', country: 'England', short: 'EPL', avg_goals: 2.82 },
  { name: 'La Liga', country: 'Spain', short: 'LaLiga', avg_goals: 2.58 },
  { name: 'Serie A', country: 'Italy', short: 'SerieA', avg_goals: 2.72 },
  { name: 'Bundesliga', country: 'Germany', short: 'Bundesliga', avg_goals: 3.16 },
  { name: 'Ligue 1', country: 'France', short: 'Ligue1', avg_goals: 2.54 },
  { name: 'Champions League', country: 'Europe', short: 'UCL', avg_goals: 2.91 }
];

/**
 * 🧠 TEAM NORMALIZATION MAP
 */
const TEAM_ALIASES = {
  'man utd': 'Manchester United', 'man city': 'Manchester City',
  'man united': 'Manchester United', 'manchester utd': 'Manchester United',
  'spurs': 'Tottenham Hotspur', 'tottenham': 'Tottenham Hotspur',
  'wolves': 'Wolverhampton Wanderers', 'newcastle': 'Newcastle United',
  'west ham': 'West Ham United', 'leicester': 'Leicester City',
  'brighton': 'Brighton & Hove Albion', 'norwich': 'Norwich City',
  'real madrid': 'Real Madrid', 'barcelona': 'FC Barcelona', 'barca': 'FC Barcelona',
  'atletico': 'Atletico Madrid', 'sevilla': 'Sevilla FC',
  'valencia': 'Valencia CF', 'juventus': 'Juventus FC',
  'inter': 'Inter Milan', 'ac milan': 'AC Milan',
  'napoli': 'SSC Napoli', 'roma': 'AS Roma',
  'dortmund': 'Borussia Dortmund', 'bayern': 'Bayern Munich',
  'psg': 'Paris Saint-Germain', 'lyon': 'Olympique Lyonnais'
};

export function normalizeTeamName(name) {
  if (!name) return name;
  const lower = name.toLowerCase().trim();
  return TEAM_ALIASES[lower] || name.trim();
}

/**
 * 📊 RELIABILITY SCORE ENGINE
 */
export function calculateReliabilityScore({ sourcesCount, dataFreshness, completeness }) {
  const sourceScore = Math.min(1, sourcesCount / 3);
  const freshnessScore = Math.max(0, 1 - dataFreshness / 60);
  const completenessScore = completeness || 0.7;

  return parseFloat(
    (sourceScore * 0.35 + freshnessScore * 0.35 + completenessScore * 0.30).toFixed(3)
  );
}

/**
 * 🔁 HYBRID DATA ENGINE (SPORTMONKS + LLM fallback)
 */
async function callLLM(prompt, schema) {
  try {
    const p = prompt.toLowerCase();

    // ⚽ FIXTURES
    if (p.includes("fixtures") || p.includes("upcoming")) {
      const res = await fetch(
        `${sportmonksBase}/fixtures?api_token=${SPORTMONKS_KEY}`
      );
      const data = await res.json();

      return {
        matches: data.data || [],
        sources: ["sportmonks"],
        fetched_at: new Date().toISOString()
      };
    }

    // 📊 STANDINGS
    if (p.includes("standings")) {
      const res = await fetch(
        `${sportmonksBase}/standings?api_token=${SPORTMONKS_KEY}`
      );
      const data = await res.json();

      return {
        standings: data.data || [],
        sources: ["sportmonks"],
        last_updated: new Date().toISOString()
      };
    }

    // 📈 RESULTS / LIVESCORES
    if (p.includes("results") || p.includes("livescores")) {
      const res = await fetch(
        `${sportmonksBase}/livescores?api_token=${SPORTMONKS_KEY}`
      );
      const data = await res.json();

      return {
        results: data.data || [],
        sources: ["sportmonks"]
      };
    }

    // 🤝 HEAD TO HEAD
    if (p.includes("head-to-head") || p.includes("h2h")) {
      const res = await fetch(
        `${sportmonksBase}/fixtures/head-to-head?api_token=${SPORTMONKS_KEY}`
      );
      const data = await res.json();

      return {
        h2h_matches: data.data || [],
        sources: ["sportmonks"]
      };
    }

    // 🧠 FALLBACK → LLM ONLY FOR TEXT REASONING
    const response = await apiClient.post('/llm/invoke', {
      prompt,
      add_context_from_internet: false,
      response_json_schema: schema
    });

    return response.data || response;
  } catch (err) {
    console.error("Data ingestion error:", err.message);

    return {
      matches: [],
      standings: [],
      results: [],
      h2h_matches: [],
      sources: []
    };
  }
}

/**
 * ⚽ FIXTURE FETCH
 */
export async function fetchUpcomingFixtures(leagueName, onProgress) {
  const league = SUPPORTED_LEAGUES.find(l => l.name === leagueName);
  if (!league) throw new Error(`Unsupported league: ${leagueName}`);

  onProgress?.(`Fetching fixtures for ${leagueName}...`);

  const prompt = `Fetch upcoming fixtures for ${leagueName}`;

  const result = await callLLM(prompt);

  onProgress?.(`Processing ${result.matches?.length || 0} fixtures...`);

  return {
    ...result,
    matches: (result.matches || []).map(m => ({
      ...m,
      home_team: normalizeTeamName(m.home_team),
      away_team: normalizeTeamName(m.away_team),
      league_name: leagueName,
      reliability_score: calculateReliabilityScore({
        sourcesCount: result.sources?.length || 1,
        dataFreshness: 2,
        completeness: m.venue ? 1 : 0.8
      })
    }))
  };
}

/**
 * 📊 STANDINGS
 */
export async function fetchLeagueStandings(leagueName, onProgress) {
  onProgress?.(`Fetching standings for ${leagueName}...`);

  const result = await callLLM(`Fetch standings for ${leagueName}`);

  return {
    ...result,
    standings: (result.standings || []).map(s => ({
      ...s,
      team: normalizeTeamName(s.team)
    }))
  };
}

/**
 * 📈 RESULTS
 */
export async function fetchRecentResults(leagueName, onProgress) {
  onProgress?.(`Fetching results for ${leagueName}...`);

  const result = await callLLM(`Fetch results for ${leagueName}`);

  return {
    ...result,
    results: (result.results || []).map(r => ({
      ...r,
      home_team: normalizeTeamName(r.home_team),
      away_team: normalizeTeamName(r.away_team),
      league_name: leagueName
    }))
  };
}

/**
 * 🤝 H2H
 */
export async function fetchHeadToHead(homeTeam, awayTeam, onProgress) {
  onProgress?.(`Fetching H2H: ${homeTeam} vs ${awayTeam}...`);

  return await callLLM(`head-to-head ${homeTeam} vs ${awayTeam}`);
}

/**
 * 📊 STRENGTH METRICS
 */
function calculateAttackStrength(teamStanding) {
  if (!teamStanding?.played) return 1.0;
  return (teamStanding.goals_for / teamStanding.played) / 1.4;
}

function calculateDefenseStrength(teamStanding) {
  if (!teamStanding?.played) return 1.0;
  return (teamStanding.goals_against / teamStanding.played) / 1.25;
}
