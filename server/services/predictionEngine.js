/**
 * ⚽ PREDICTION ENGINE CONNECTOR
 * Consumes normalized team stats
 * Integrates Elo probability model + Poisson inputs
 */

import { calculateEloProbabilities } from "../lib/eloModel.js";

// ==========================
// 📊 BUILD TEAM FEATURE SET
// ==========================
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

      // ⚽ POISSON FEATURES
      avg_goals_scored: goalsFor / played,
      avg_goals_conceded: goalsAgainst / played,

      // 📊 FORM STRENGTH
      form_weight: (wins * 3 + draws * 1) / (played * 3),

      // ⚡ ELO RATING (base)
      elo_rating: team.elo_rating || 1500,

      // 📉 STRUCTURE
      played,
      wins,
      draws,
      losses,
      form
    };
  }

  return teams;
}

// ==========================
// ⚽ MATCH INPUT + ELO INTEGRATION
// ==========================
export function buildMatchInput(home, away, teams) {
  const H = teams[home];
  const A = teams[away];

  if (!H || !A) return null;

  // 🧠 APPLY ELO MODEL HERE
  const elo = calculateEloProbabilities(
    { elo_rating: H.elo_rating },
    { elo_rating: A.elo_rating }
  );

  return {
    home,
    away,

    // ⚽ POISSON ATTACK/DEFENSE
    home_attack: H.avg_goals_scored,
    home_defense: H.avg_goals_conceded,

    away_attack: A.avg_goals_scored,
    away_defense: A.avg_goals_conceded,

    // ⚡ ELO LAYER (CONNECTED)
    home_elo: elo.home_elo,
    away_elo: elo.away_elo,
    elo_diff: elo.elo_diff,

    // 🎯 WIN PROBABILITIES
    probabilities: {
      home_win: elo.home_win,
      draw: elo.draw,
      away_win: elo.away_win
    },

    // 📊 FORM SIGNALS
    home_form: H.form_weight,
    away_form: A.form_weight,

    model: "elo + poisson-ready"
  };
}
