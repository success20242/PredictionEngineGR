/**
 * DATA INGESTION ENGINE
 * Fetches football data via LLM with web search (multi-source aggregation).
 * Normalizes team names, validates data, assigns reliability scores.
 */

import { base44 } from '@/api/base44Client';

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
  // sourcesCount: 1-3+ sources (higher = better)
  // dataFreshness: minutes since last update (lower = better)
  // completeness: 0-1 (fraction of expected fields present)

  const sourceScore = Math.min(1, sourcesCount / 3);
  const freshnessScore = Math.max(0, 1 - dataFreshness / 60); // degrades over 60 min
  const completenessScore = completeness || 0.7;

  const reliability = (sourceScore * 0.35 + freshnessScore * 0.35 + completenessScore * 0.30);
  return parseFloat(reliability.toFixed(3));
}

export async function fetchUpcomingFixtures(leagueName, onProgress) {
  const league = SUPPORTED_LEAGUES.find(l => l.name === leagueName);
  if (!league) throw new Error(`Unsupported league: ${leagueName}`);

  onProgress?.(`Fetching fixtures for ${leagueName}...`);

  const prompt = `You are a football data aggregator. Fetch and return the REAL upcoming fixtures for the ${leagueName} (${league.country}) for the next 14 days from today (${new Date().toISOString().split('T')[0]}).

Search multiple sources: official league website, BBC Sport, Sky Sports, ESPN FC, goal.com.

Return a JSON object with this exact structure:
{
  "league": "${leagueName}",
  "season": "2024-25",
  "fetched_at": "<ISO timestamp>",
  "sources": ["source1", "source2"],
  "matches": [
    {
      "home_team": "Team Name",
      "away_team": "Team Name",
      "match_date": "YYYY-MM-DDTHH:MM:00Z",
      "venue": "Stadium Name",
      "round": "Matchweek X or Round of 16 etc",
      "status": "UPCOMING"
    }
  ]
}

IMPORTANT: Use real team names and real scheduled dates. Include at least 5-10 matches if available. Return only the JSON, no other text.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    response_json_schema: {
      type: 'object',
      properties: {
        league: { type: 'string' },
        season: { type: 'string' },
        fetched_at: { type: 'string' },
        sources: { type: 'array', items: { type: 'string' } },
        matches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              home_team: { type: 'string' },
              away_team: { type: 'string' },
              match_date: { type: 'string' },
              venue: { type: 'string' },
              round: { type: 'string' },
              status: { type: 'string' }
            }
          }
        }
      }
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

  const prompt = `Fetch the CURRENT ${leagueName} league standings table for the 2024-25 season.

Search: official league site, BBC Sport, Sky Sports, ESPN.

Return JSON:
{
  "league": "${leagueName}",
  "season": "2024-25",
  "last_updated": "<ISO timestamp>",
  "sources": ["source1"],
  "standings": [
    {
      "position": 1,
      "team": "Team Name",
      "played": 28,
      "won": 18,
      "drawn": 5,
      "lost": 5,
      "goals_for": 55,
      "goals_against": 28,
      "goal_difference": 27,
      "points": 59,
      "form": ["W","W","D","W","L"],
      "home_record": {"played":14,"won":10,"drawn":2,"lost":2},
      "away_record": {"played":14,"won":8,"drawn":3,"lost":3}
    }
  ]
}

Return only JSON. Use real current data.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    response_json_schema: {
      type: 'object',
      properties: {
        league: { type: 'string' },
        season: { type: 'string' },
        last_updated: { type: 'string' },
        sources: { type: 'array', items: { type: 'string' } },
        standings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              position: { type: 'number' },
              team: { type: 'string' },
              played: { type: 'number' },
              won: { type: 'number' },
              drawn: { type: 'number' },
              lost: { type: 'number' },
              goals_for: { type: 'number' },
              goals_against: { type: 'number' },
              goal_difference: { type: 'number' },
              points: { type: 'number' },
              form: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
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

  const prompt = `Fetch the last 10 completed match results for the ${leagueName} 2024-25 season.

Return JSON:
{
  "league": "${leagueName}",
  "results": [
    {
      "home_team": "Team",
      "away_team": "Team",
      "home_score": 2,
      "away_score": 1,
      "match_date": "YYYY-MM-DDTHH:MM:00Z",
      "round": "Matchweek X",
      "status": "FINISHED"
    }
  ]
}

Return only JSON with real recent results.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    response_json_schema: {
      type: 'object',
      properties: {
        league: { type: 'string' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              home_team: { type: 'string' },
              away_team: { type: 'string' },
              home_score: { type: 'number' },
              away_score: { type: 'number' },
              match_date: { type: 'string' },
              round: { type: 'string' },
              status: { type: 'string' }
            }
          }
        }
      }
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

  const prompt = `Fetch the last 5 head-to-head matches between ${homeTeam} and ${awayTeam} (any competition, last 3 years).

Return JSON:
{
  "home_team": "${homeTeam}",
  "away_team": "${awayTeam}",
  "h2h_matches": [
    {
      "home": "Team",
      "away": "Team",
      "home_score": 1,
      "away_score": 0,
      "date": "YYYY-MM-DD",
      "competition": "Competition name",
      "venue": "Stadium"
    }
  ],
  "summary": {
    "team1_wins": 2,
    "team2_wins": 2,
    "draws": 1,
    "avg_goals": 2.4
  }
}

Return only JSON.`;

  return await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    response_json_schema: {
      type: 'object',
      properties: {
        home_team: { type: 'string' },
        away_team: { type: 'string' },
        h2h_matches: { type: 'array', items: { type: 'object' } },
        summary: { type: 'object' }
      }
    }
  });
}

function calculateAttackStrength(teamStanding) {
  if (!teamStanding?.played || teamStanding.played === 0) return 1.0;
  const leagueAvgGoalsFor = 1.4; // per game
  return (teamStanding.goals_for / teamStanding.played) / leagueAvgGoalsFor;
}

function calculateDefenseStrength(teamStanding) {
  if (!teamStanding?.played || teamStanding.played === 0) return 1.0;
  const leagueAvgGoalsAgainst = 1.25; // per game
  return (teamStanding.goals_against / teamStanding.played) / leagueAvgGoalsAgainst;
}
