/**
 * ⚽ PREDICTION ENGINE CONNECTOR
 * Consumes normalized team stats
 * Outputs Elo + Poisson-ready structure
 */

export function buildPredictionInput(standings) {
  const teams = {};

  for (const team of standings) {
    const name = team.team || team.name;

    const played = team.played || 1;

    const goalsFor = team.goals_for || 0;
    const goalsAgainst = team.goals_against || 0;

    const wins = team.wins || 0;
    const draws = team.draws || 0;
    const losses = team.losses || 0;

    const form = Array.isArray(team.form)
      ? team.form.join("")
      : team.recent_form || "";

    teams[name] = {
      team: name,

      // 🔥 POISSON INPUTS
      avg_goals_scored: goalsFor / played,
      avg_goals_conceded: goalsAgainst / played,

      // ⚽ FORM FACTOR
      form_weight:
        (wins * 3 + draws * 1) / (played * 3),

      // 📊 ELO BASE
      elo: team.elo_rating || 1500,

      // 📉 STRUCTURE
      played,
      wins,
      draws,
      losses,
      form,
    };
  }

  return teams;
}

// ==========================
// ⚽ MATCH PROBABILITY INPUT
// ==========================
export function buildMatchInput(home, away, teams) {
  const H = teams[home];
  const A = teams[away];

  if (!H || !A) return null;

  return {
    home,
    away,

    home_attack: H.avg_goals_scored,
    home_defense: H.avg_goals_conceded,

    away_attack: A.avg_goals_scored,
    away_defense: A.avg_goals_conceded,

    home_elo: H.elo,
    away_elo: A.elo,

    home_form: H.form_weight,
    away_form: A.form_weight,
  };
}
