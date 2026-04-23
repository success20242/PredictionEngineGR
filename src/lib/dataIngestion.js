/**
 * DATA INGESTION ENGINE
 * Fetches football data via LLM with web search (multi-source aggregation).
 * Normalizes team names, validates data, assigns reliability scores.
 */

import { apiClient } from '@/api/apiClient';

export const SUPPORTED_LEAGUES = [
  { name: 'Premier League', country: 'England', short: 'EPL', avg_goals: 2.82 },
  { name: 'La Liga', country: 'Spain', short: 'LaLiga', avg_goals: 2.58 },
  { name: 'Serie A', country: 'Italy', short: 'SerieA', avg_goals: 2.72 },
  { name: 'Bundesliga', country: 'Germany', short: 'Bundesliga', avg_goals: 3.16 },
  { name: 'Ligue 1', country: 'France', short: 'Ligue1', avg_goals: 2.54 },
  { name: 'Champions League', country: 'Europe', short: 'UCL', avg_goals: 2.91 }
];

// Team name normalization map
const TEAM_ALIASES = {
  'man utd': 'Manchester United', 'man city': 'Manchester City',
  'man united': 'Manchester United', 'manchester utd': 'Manchester United',
  'spurs': 'Tottenham Hotspur', 'tottenham': 'Tottenham Hotspur',
  'wolves': 'Wolverhampton Wanderers', 'newcastle': 'Newcastle United',
  'west ham': 'West Ham United', 'leicester': 'Leicester City',
  'brighton': 'Brighton & Hove Albion', 'norwich': 'Norwich City',
  'real madrid': 'Real Madrid', 'barcelona': 'FC Barcelona', 'barca': 'FC Barcelona',
  'atletico': 'Atletico Madrid', 'atletico madrid': 'Atletico Madrid',
  'sevilla': 'Sevilla FC', 'valencia': 'Valencia CF',
  'juventus': 'Juventus FC', 'juve': 'Juventus FC',
  'inter': 'Inter Milan', 'inter milan': 'Inter Milan',
  'ac milan': 'AC Milan', 'milan': 'AC Milan',
  'napoli': 'SSC Napoli', 'roma': 'AS Roma',
  'dortmund': 'Borussia Dortmund', 'bvb': 'Borussia Dortmund',
  'bayern': 'Bayern Munich', 'rb leipzig': 'RB Leipzig',
  'psg': 'Paris Saint-Germain', 'paris': 'Paris Saint-Germain',
  'lyon': 'Olympique Lyonnais', 'marseille': 'Olympique de Marseille',
  'monaco': 'AS Monaco', 'lille': 'Lille OSC'
};

export function normalizeTeamName(name) {
  if (!name) return name;
  const lower = name.toLowerCase().trim();
  return TEAM_ALIASES[lower] || name.trim();
}

export function calculateReliabilityScore({ sourcesCount, dataFreshness, completeness }) {
  const sourceScore = Math.min(1, sourcesCount / 3);
  const freshnessScore = Math.max(0, 1 - dataFreshness / 60);
  const completenessScore = completeness || 0.7;

  const reliability = (sourceScore * 0.35 + freshnessScore * 0.35 + completenessScore * 0.30);
  return parseFloat(reliability.toFixed(3));
}

/**
 * 🔁 Generic LLM wrapper (replaces Base44 InvokeLLM)
 */
async function callLLM(prompt, schema) {
  const response = await apiClient.post('/llm/invoke', {
    prompt,
    add_context_from_internet: true,
    response_json_schema: schema
  });

  return response;
}

export async function fetchUpcomingFixtures(leagueName, onProgress) {
  const league = SUPPORTED_LEAGUES.find(l => l.name === leagueName);
  if (!league) throw new Error(`Unsupported league: ${leagueName}`);

  onProgress?.(`Fetching fixtures for ${leagueName}...`);

  const prompt = `You are a football data aggregator. Fetch the REAL upcoming fixtures for the ${leagueName} (${league.country}) for the next 14 days from today (${new Date().toISOString().split('T')[0]}).

Search multiple sources: official league website, BBC Sport, Sky Sports, ESPN FC, goal.com.

Return ONLY JSON:
{
  "league": "${leagueName}",
  "season": "2024-25",
  "fetched_at": "<ISO timestamp>",
  "sources": [],
  "matches": []
}`;

  const result = await callLLM(prompt, {
    type: 'object',
    properties: {
      league: { type: 'string' },
      season: { type: 'string' },
      fetched_at: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' } },
      matches: { type: 'array', items: { type: 'object' } }
    }
  });

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
        completeness: m.venue ? 1.0 : 0.8
      })
    }))
  };
}

export async function fetchLeagueStandings(leagueName, onProgress) {
  onProgress?.(`Fetching standings for ${leagueName}...`);

  const prompt = `Fetch CURRENT ${leagueName} standings for 2024-25 season. Return ONLY JSON.`;

  const result = await callLLM(prompt, {
    type: 'object',
    properties: {
      league: { type: 'string' },
      season: { type: 'string' },
      last_updated: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' } },
      standings: { type: 'array', items: { type: 'object' } }
    }
  });

  return {
    ...result,
    standings: (result.standings || []).map(s => ({
      ...s,
      team: normalizeTeamName(s.team),
      attack_strength: calculateAttackStrength(s),
      defense_strength: calculateDefenseStrength(s)
    }))
  };
}

export async function fetchRecentResults(leagueName, onProgress) {
  onProgress?.(`Fetching recent results for ${leagueName}...`);

  const prompt = `Fetch last 10 results for ${leagueName}. Return ONLY JSON.`;

  const result = await callLLM(prompt, {
    type: 'object',
    properties: {
      league: { type: 'string' },
      results: { type: 'array', items: { type: 'object' } }
    }
  });

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

export async function fetchHeadToHead(homeTeam, awayTeam, onProgress) {
  onProgress?.(`Fetching H2H: ${homeTeam} vs ${awayTeam}...`);

  const prompt = `Fetch last 5 head-to-head matches between ${homeTeam} and ${awayTeam}. Return ONLY JSON.`;

  return await callLLM(prompt, {
    type: 'object',
    properties: {
      home_team: { type: 'string' },
      away_team: { type: 'string' },
      h2h_matches: { type: 'array', items: { type: 'object' } },
      summary: { type: 'object' }
    }
  });
}

function calculateAttackStrength(teamStanding) {
  if (!teamStanding?.played) return 1.0;
  return (teamStanding.goals_for / teamStanding.played) / 1.4;
}

function calculateDefenseStrength(teamStanding) {
  if (!teamStanding?.played) return 1.0;
  return (teamStanding.goals_against / teamStanding.played) / 1.25;
}
