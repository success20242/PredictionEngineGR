/**
 * ⚽ PREDICTION ENGINE (FINAL CLEAN VERSION)
 * Combines:
 * - Elo model (probabilities)
 * - Poisson model (expected goals)
 * - Form model (recent performance weighting)
 * - Normalized team stats
 */

// ==========================
// 📦 IMPORT MODELS (FIXED PATHS)
// ==========================
import { calculateEloProbabilities } from "../../src/lib/eloModel.js";
import { calculatePoissonProbabilities } from "../../src/lib/poissonModel.js";
import {
  calculateFormScore,
  calculateMomentum,
  calculateFormProbabilities
} from "../../src/lib/formModel.js";

// ==========================
// 📊 BUILD TEAM FEATURES
// ==========================
export function buildPredictionInput(standings) {
  // ✅ SAFETY CHECK 1: Validate input
  if (!Array.isArray(standings)) {
    console.error("❌ buildPredictionInput: standings is not an array");
    console.error("Received:", typeof standings, standings);
    return {};
  }

  if (standings.length === 0) {
    console.warn("⚠️ buildPredictionInput: standings array is empty");
    return {};
  }

  const teams = {};

  for (const team of standings) {
    // ✅ SAFETY CHECK 2: Guard against undefined/null entries
    if (!team || typeof team !== 'object') {
      console.warn("⚠️ Skipping invalid team entry:", team);
      continue;
    }

    // ✅ SAFETY CHECK 3: Validate team name exists
    const name = team.team || team.name;
    if (!name) {
      console.warn("⚠️ Team entry missing name field:", team);
      continue;
    }

    // ✅ SAFETY CHECK 4: Safely extract stats with defaults
    const played = Math.max(team.played || 1, 1); // Prevent division by zero
    const goalsFor = Number(team.goals_for) || 0;
    const goalsAgainst = Number(team.goals_against) || 0;

    const wins = Number(team.wins) || 0;
    const draws = Number(team.draws) || 0;
    const losses = Number(team.losses) || 0;

    // ✅ SAFETY CHECK 5: Handle form data safely
    const formArray = Array.isArray(team.form)
      ? team.form
      : (typeof team.recent_form === 'string' ? team.recent_form.split("") : []);

    try {
      teams[name] = {
        team: name,

        // ⚽ POISSON FEATURES
        avg_goals_scored: goalsFor / played,
        avg_goals_conceded: goalsAgainst / played,

        attack_strength: goalsFor / played || 1,
        defense_strength: goalsAgainst / played || 1,

        // 📊 FORM MODEL
        form_weight: calculateFormScore(formArray),
        form: formArray,

        // ⚡ ELO BASE
        elo_rating: Number(team.elo_rating) || 1500,

        played,
        wins,
        draws,
        losses
      };
    } catch (err) {
      console.error(`❌ Error processing team ${name}:`, err.message);
      continue;
    }
  }

  if (Object.keys(teams).length === 0) {
    console.warn("⚠️ No valid teams processed from standings");
  }

  return teams;
}

// ==========================
// ⚽ MATCH PREDICTION ENGINE
// ==========================
export function buildMatchInput(home, away, teams) {
  // ✅ SAFETY CHECK 1: Validate input parameters
  if (!teams || typeof teams !== 'object') {
    console.error("❌ buildMatchInput: teams is not an object");
    return null;
  }

  if (!home || !away) {
    console.error("❌ buildMatchInput: missing home or away team name");
    return null;
  }

  // ✅ SAFETY CHECK 2: Verify teams exist
  const H = teams[home];
  const A = teams[away];

  if (!H) {
    console.warn(`⚠️ Home team "${home}" not found in teams data`);
    return null;
  }

  if (!A) {
    console.warn(`⚠️ Away team "${away}" not found in teams data`);
    return null;
  }

  try {
    // ⚡ ELO MODEL
    const elo = calculateEloProbabilities(
      { elo_rating: H.elo_rating },
      { elo_rating: A.elo_rating }
    );

    // ⚽ POISSON MODEL
    const poisson = calculatePoissonProbabilities(H, A);

    // 📊 FORM MODEL
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
  } catch (err) {
    console.error(`❌ Error building match prediction for ${home} vs ${away}:`, err.message);
    return null;
  }
}
