/**
 * ⚽ PREDICTION ENGINE (FINAL CLEAN VERSION)
 * Combines:
 * - Elo model (probabilities)
 * - Poisson model (expected goals)
 * - Form model (recent performance weighting)
 * - Normalized team stats
 */

import { calculateEloProbabilities } from "./eloModel.js";
import { calculatePoissonProbabilities } from "./poissonModel.js";
import {
  calculateFormScore,
  calculateMomentum,
  calculateFormProbabilities
} from "./formModel.js";

// ==========================
// 📊 BUILD TEAM FEATURES
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

    const formArray = Array.isArray(team.form)
      ? team.form
      : (team.recent_form || "").split("");

    teams[name] = {
      team: name,

      // ⚽ POISSON FEATURES
      avg_goals_scored: goalsFor / played,
      avg_goals_conceded: goalsAgainst / played,

      attack_strength: goalsFor / played || 1,
      defense_strength: goalsAgainst / played || 1,

      // 📊 FORM MODEL (FIXED)
      form_weight: calculateFormScore(formArray),

      form: formArray,

      // ⚡ ELO BASE
      elo_rating: team.elo_rating || 1500,

      played,
      wins,
      draws,
      losses
    };
  }

  return teams;
}

// ==========================
// ⚽ MATCH PREDICTION ENGINE
// ==========================
export function buildMatchInput(home, away, teams) {
  const H = teams[home];
  const A = teams[away];

  if (!H || !A) return null;

  // ⚡ ELO MODEL
  const elo = calculateEloProbabilities(
    { elo_rating: H.elo_rating },
    { elo_rating: A.elo_rating }
  );

  // ⚽ POISSON MODEL
  const poisson = calculatePoissonProbabilities(H, A);

  // 📊 FORM MODEL (optional enhancement)
  const form = calculateFormProbabilities(H, A);

  return {
    home,
    away,

    // ==========================
    // ⚡ ELO OUTPUT
    // ==========================
    elo: {
      home_win: elo.home_win,
      draw: elo.draw,
      away_win: elo.away_win,
      home_elo: elo.home_elo,
      away_elo: elo.away_elo,
      elo_diff: elo.elo_diff
    },

    // ==========================
    // ⚽ POISSON OUTPUT
    // ==========================
    poisson: {
      home_win: poisson.home_win,
      draw: poisson.draw,
      away_win: poisson.away_win,
      expected_home_goals: poisson.expected_home_goals,
      expected_away_goals: poisson.expected_away_goals
    },

    // ==========================
    // 📊 FORM OUTPUT
    // ==========================
    form: {
      home_win: form.home_win,
      draw: form.draw,
      away_win: form.away_win,
      home_momentum: form.home_momentum,
      away_momentum: form.away_momentum
    },

    // ==========================
    // 📊 TEAM STATS
    // ==========================
    stats: {
      home_attack: H.avg_goals_scored,
      home_defense: H.avg_goals_conceded,
      away_attack: A.avg_goals_scored,
      away_defense: A.avg_goals_conceded,

      home_form: H.form_weight,
      away_form: A.form_weight
    },

    model: "ELO + POISSON + FORM HYBRID"
  };
}
