/**
 * ⚙️ LIVE DATA NORMALIZER LAYER (HARMONIZED)
 * Converts ALL sources (scraper, APIs, fallback) into prediction-ready dataset
 * Compatible with:
 * - BBC / Sky / ESPN scraper
 * - football-data.org
 * - future APIs
 */

// ==========================
// 🧱 TEAM TEMPLATE
// ==========================
function createTeam(name) {
  return {
    team: name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    form: [],
    elo_rating: 1500,
    source: "normalized"
  };
}

// ==========================
// 🧹 CLEAN INPUT
// ==========================
function clean(name) {
  if (!name) return null;
  return String(name).replace(/\s+/g, " ").trim();
}

// ==========================
// 📊 APPLY MATCH RESULT
// ==========================
function applyMatch(team, gf, ga) {
  team.played += 1;
  team.goals_for += gf;
  team.goals_against += ga;

  if (gf > ga) {
    team.wins += 1;
    team.form.push("W");
  } else if (gf < ga) {
    team.losses += 1;
    team.form.push("L");
  } else {
    team.draws += 1;
    team.form.push("D");
  }

  if (team.form.length > 5) {
    team.form.shift();
  }
}

// ==========================
// 🧠 FINAL TRANSFORMATION
// ==========================
function finalize(team) {
  const avgScored = team.played ? team.goals_for / team.played : 0;
  const avgConceded = team.played ? team.goals_against / team.played : 0;

  return {
    team: team.team,
    played: team.played,
    wins: team.wins,
    draws: team.draws,
    losses: team.losses,
    goals_for: team.goals_for,
    goals_against: team.goals_against,

    avg_goals_scored: +avgScored.toFixed(2),
    avg_goals_conceded: +avgConceded.toFixed(2),

    form: team.form,
    recent_form: team.form.join(""),

    elo_rating: team.elo_rating,
    source: team.source
  };
}

// ==========================
// 🔁 MAIN NORMALIZER ENTRY
// ==========================
export function normalizeMatchData(matches = []) {
  if (!Array.isArray(matches)) return [];

  const teams = {};

  for (const m of matches) {
    const home = clean(m.home_team || m.home || m.team_home);
    const away = clean(m.away_team || m.away || m.team_away);

    if (!home || !away) continue;

    if (!teams[home]) teams[home] = createTeam(home);
    if (!teams[away]) teams[away] = createTeam(away);

    const hg = Number(m.home_goals ?? m.score?.home ?? m.hg ?? 0);
    const ag = Number(m.away_goals ?? m.score?.away ?? m.ag ?? 0);

    if (isNaN(hg) || isNaN(ag)) continue;

    applyMatch(teams[home], hg, ag);
    applyMatch(teams[away], ag, hg);
  }

  return Object.values(teams).map(finalize);
}
