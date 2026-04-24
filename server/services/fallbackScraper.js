/**
 * 🌐 HYBRID FALLBACK SCRAPER ENGINE
 * Multi-source scraping + derived team stats
 * Compatible with your backend routes
 */

import axios from "axios";
import * as cheerio from "cheerio";

// ==========================
// 🔗 SOURCES
// ==========================
const SOURCES = [
  {
    name: "bbc",
    url: "https://www.bbc.com/sport/football/scores-fixtures",
  },
  {
    name: "sky",
    url: "https://www.skysports.com/football-results",
  },
  {
    name: "espn",
    url: "https://www.espn.com/soccer/scoreboard",
  },
];

// ==========================
// 🧼 HELPERS
// ==========================
function cleanTeamName(name) {
  return name?.replace(/\s+/g, " ").trim();
}

// ==========================
// 🕷️ SCRAPE MATCHES (MULTI SOURCE)
// ==========================
async function scrapeMatches() {
  const matches = [];

  for (const source of SOURCES) {
    try {
      const res = await axios.get(source.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(res.data);

      // ===== BBC =====
      if (source.name === "bbc") {
        $(".sp-c-fixture").each((_, el) => {
          const home = cleanTeamName(
            $(el)
              .find(".sp-c-fixture__team--home .sp-c-fixture__team-name")
              .text()
          );

          const away = cleanTeamName(
            $(el)
              .find(".sp-c-fixture__team--away .sp-c-fixture__team-name")
              .text()
          );

          const score = $(el)
            .find(".sp-c-fixture__number--ft")
            .text()
            .trim();

          if (!home || !away || !score) return;

          const [hg, ag] = score.split("-").map(Number);
          if (isNaN(hg) || isNaN(ag)) return;

          matches.push({
            source: "bbc",
            home_team: home,
            away_team: away,
            home_goals: hg,
            away_goals: ag,
          });
        });
      }

      // ===== SKY =====
      if (source.name === "sky") {
        $(".fixres__item").each((_, el) => {
          const teams = $(el)
            .find(".swap-text__target")
            .map((i, t) => $(t).text())
            .get();

          if (teams.length >= 2) {
            matches.push({
              source: "sky",
              home_team: cleanTeamName(teams[0]),
              away_team: cleanTeamName(teams[1]),
              home_goals: null,
              away_goals: null,
            });
          }
        });
      }

      // ===== ESPN =====
      if (source.name === "espn") {
        $(".Scoreboard").each((_, el) => {
          const teams = $(el)
            .find(".ScoreCell__TeamName")
            .map((i, t) => $(t).text())
            .get();

          if (teams.length >= 2) {
            matches.push({
              source: "espn",
              home_team: cleanTeamName(teams[0]),
              away_team: cleanTeamName(teams[1]),
              home_goals: null,
              away_goals: null,
            });
          }
        });
      }
    } catch (err) {
      console.error(`❌ ${source.name} scrape failed:`, err.message);
    }
  }

  return matches;
}

// ==========================
// 🧠 BUILD TEAM STATS
// ==========================
function buildTeamStats(matches) {
  const teams = {};

  for (const m of matches) {
    if (!m.home_team || !m.away_team) continue;

    if (!teams[m.home_team]) initTeam(teams, m.home_team);
    if (!teams[m.away_team]) initTeam(teams, m.away_team);

    // only update stats if score exists
    if (m.home_goals !== null && m.away_goals !== null) {
      updateStats(teams[m.home_team], m.home_goals, m.away_goals);
      updateStats(teams[m.away_team], m.away_goals, m.home_goals);
    }
  }

  return Object.values(teams).map(finalizeTeamStats);
}

function initTeam(store, name) {
  store[name] = {
    team: name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    form: [],
  };
}

function updateStats(team, gf, ga) {
  team.played++;
  team.goals_for += gf;
  team.goals_against += ga;

  if (gf > ga) {
    team.wins++;
    pushForm(team, "W");
  } else if (gf === ga) {
    team.draws++;
    pushForm(team, "D");
  } else {
    team.losses++;
    pushForm(team, "L");
  }
}

function pushForm(team, result) {
  team.form.push(result);
  if (team.form.length > 5) team.form.shift();
}

function finalizeTeamStats(team) {
  return {
    ...team,
    avg_goals_scored: +(team.goals_for / team.played || 0).toFixed(2),
    avg_goals_conceded: +(team.goals_against / team.played || 0).toFixed(2),
    recent_form: team.form.join(""),
    elo_rating: 1500, // your system updates this
  };
}

// ==========================
// 📅 FIXTURES
// ==========================
export async function scrapeFixtures() {
  const matches = await scrapeMatches();

  return {
    matches,
    sources: ["bbc", "sky", "espn"],
  };
}

// ==========================
// 📊 STANDINGS
// ==========================
export async function scrapeStandings() {
  const matches = await scrapeMatches();
  const standings = buildTeamStats(matches);

  return {
    standings,
    sources: ["bbc", "sky", "espn"],
  };
}

// ==========================
// 📈 RESULTS
// ==========================
export async function scrapeResults() {
  const matches = await scrapeMatches();

  return {
    results: matches,
    sources: ["bbc", "sky", "espn"],
  };
}

// ==========================
// 🔁 H2H
// ==========================
export async function scrapeH2H(home, away) {
  const matches = await scrapeMatches();

  const filtered = matches.filter(
    (m) =>
      (m.home_team === home && m.away_team === away) ||
      (m.home_team === away && m.away_team === home)
  );

  return {
    h2h_matches: filtered.slice(-5),
    sources: ["bbc", "sky", "espn"],
  };
}
