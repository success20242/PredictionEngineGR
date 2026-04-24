/**
 * ⚽ PREDICTION ENGINE (FINAL CLEAN VERSION)
 * ELO + POISSON + FORM HYBRID
 */

// ==========================
// 📦 IMPORT MODELS (FIXED)
// ==========================
import { calculateEloProbabilities } from "../lib/eloModel.js";
import { calculatePoissonProbabilities } from "../lib/poissonModel.js";
import {
  calculateFormScore,
  calculateFormProbabilities
} from "../lib/formModel.js";

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

      avg_goals_scored: goalsFor / played,
      avg_goals_conceded: goalsAgainst / played,

      attack_strength: goalsFor / played || 1,
      defense_strength: goalsAgainst / played || 1,

      form_weight: calculateFormScore(formArray),
      form: formArray,

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
// ⚽ MATCH ENGINE
// ==========================
export function buildMatchInput(home, away, teams) {
  const H = teams[home];
  const A = teams[away];

  if (!H || !A) return null;

  const elo = calculateEloProbabilities(
    { elo_rating: H.elo_rating },
    { elo_rating: A.elo_rating }
  );

  const poisson = calculatePoissonProbabilities(H, A);

  const form = calculateFormProbabilities(H, A);

  return {
    home,
    away,

    elo: {
      home_win: elo.home_win,
      draw: elo.draw,
      away_win: elo.away_win,
      home_elo: elo.home_elo,
      away_elo: elo.away_elo,
      elo_diff: elo.elo_diff
    },

    poisson: {
      home_win: poisson.home_win,
      draw: poisson.draw,
      away_win: poisson.away_win,
      expected_home_goals: poisson.expected_home_goals,
      expected_away_goals: poisson.expected_away_goals
    },

    form: {
      home_win: form.home_win,
      draw: form.draw,
      away_win: form.away_win,
      home_momentum: form.home_momentum,
      away_momentum: form.away_momentum
    },

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
