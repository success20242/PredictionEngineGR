/**
 * 🌐 FALLBACK SCRAPER ENGINE
 * Scrapes football data from public sources when Sportmonks fails
 * Returns RAW structured data only (no calculations)
 */

import axios from "axios";
import * as cheerio from "cheerio";

// 🔗 Trusted sources
const SOURCES = [
  {
    name: "bbc",
    url: "https://www.bbc.com/sport/football/scores-fixtures"
  },
  {
    name: "sky_sports",
    url: "https://www.skysports.com/football-fixtures-results"
  },
  {
    name: "espn",
    url: "https://www.espn.com/soccer/scoreboard"
  }
];

// 🧠 Normalize team names (keep consistent with your engine)
function cleanTeamName(name) {
  return name?.replace(/\s+/g, " ").trim();
}

/**
 * ⚽ SCRAPE FIXTURES + RESULTS
 */
export async function scrapeMatches() {
  const results = [];

  for (const source of SOURCES) {
    try {
      const res = await axios.get(source.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 10000
      });

      const $ = cheerio.load(res.data);

      // 🟡 BBC parsing (most stable)
      if (source.name === "bbc") {
        $(".qa-match-block").each((_, el) => {
          const home = cleanTeamName($(el).find(".sp-c-fixture__team--home").text());
          const away = cleanTeamName($(el).find(".sp-c-fixture__team--away").text());
          const score = $(el).find(".sp-c-fixture__number--ft").text();

          results.push({
            source: "bbc",
            home_team: home,
            away_team: away,
            score: score || null,
            date: new Date().toISOString()
          });
        });
      }

      // 🔵 Sky Sports parsing
      if (source.name === "sky_sports") {
        $(".fixres__item").each((_, el) => {
          const teams = $(el).find(".swap-text__target").map((i, t) => $(t).text()).get();

          if (teams.length >= 2) {
            results.push({
              source: "sky_sports",
              home_team: cleanTeamName(teams[0]),
              away_team: cleanTeamName(teams[1]),
              score: null,
              date: new Date().toISOString()
            });
          }
        });
      }

      // 🔴 ESPN parsing
      if (source.name === "espn") {
        $(".Scoreboard").each((_, el) => {
          const teams = $(el).find(".ScoreCell__TeamName").map((i, t) => $(t).text()).get();

          if (teams.length >= 2) {
            results.push({
              source: "espn",
              home_team: cleanTeamName(teams[0]),
              away_team: cleanTeamName(teams[1]),
              score: null,
              date: new Date().toISOString()
            });
          }
        });
      }

    } catch (err) {
      console.error(`❌ Scraping failed for ${source.name}:`, err.message);
    }
  }

  return results;
}

/**
 * 📊 BUILD TEAM RAW DATA FROM MATCHES
 * (NO calculations like Elo here — just structure)
 */
export function buildTeamDataset(matches) {
  const teams = {};

  matches.forEach((m) => {
    if (!m.home_team || !m.away_team) return;

    // init teams
    if (!teams[m.home_team]) {
      teams[m.home_team] = createEmptyTeam(m.home_team);
    }
    if (!teams[m.away_team]) {
      teams[m.away_team] = createEmptyTeam(m.away_team);
    }

    // increment played
    teams[m.home_team].played += 1;
    teams[m.away_team].played += 1;

    // parse score if exists
    if (m.score && m.score.includes("-")) {
      const [h, a] = m.score.split("-").map(Number);

      teams[m.home_team].goals_for += h;
      teams[m.home_team].goals_against += a;

      teams[m.away_team].goals_for += a;
      teams[m.away_team].goals_against += h;

      // results
      if (h > a) {
        teams[m.home_team].wins++;
        teams[m.away_team].losses++;
        updateForm(teams[m.home_team], "W");
        updateForm(teams[m.away_team], "L");
      } else if (h < a) {
        teams[m.away_team].wins++;
        teams[m.home_team].losses++;
        updateForm(teams[m.away_team], "W");
        updateForm(teams[m.home_team], "L");
      } else {
        teams[m.home_team].draws++;
        teams[m.away_team].draws++;
        updateForm(teams[m.home_team], "D");
        updateForm(teams[m.away_team], "D");
      }
    }
  });

  return Object.values(teams);
}

// 🧱 Empty team template
function createEmptyTeam(name) {
  return {
    team_name: name,
    league: "Unknown",
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    form: []
  };
}

// 🔁 Update last 5 form
function updateForm(team, result) {
  team.form.push(result);
  if (team.form.length > 5) {
    team.form.shift();
  }
}

/**
 * 🚀 MAIN FALLBACK ENTRY
 */
export async function getFallbackData() {
  const matches = await scrapeMatches();
  const teams = buildTeamDataset(matches);

  return {
    source: "fallback_scraper",
    matches,
    teams,
    fetched_at: new Date().toISOString()
  };
}
