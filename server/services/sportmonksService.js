import axios from "axios";

const SPORTMONKS_BASE_URL =
  "https://api.sportmonks.com/api/v3/football";

const SPORTMONKS_TOKEN = process.env.SPORTMONKS_API_KEY;

const api = axios.create({
  baseURL: SPORTMONKS_BASE_URL,
  timeout: 20000,
});

// Helper: attach token automatically
const withToken = (url) => {
  return `${url}${url.includes("?") ? "&" : "?"}api_token=${SPORTMONKS_TOKEN}`;
};

// ⚽ Live scores
export const getLiveScores = async () => {
  try {
    const response = await api.get(
      withToken("/livescores")
    );

    return response.data;
  } catch (error) {
    console.error(
      "Sportmonks LiveScores Error:",
      error.response?.data || error.message
    );

    return { data: [] };
  }
};

// ⚽ Fixtures (by date or league)
export const getFixtures = async (date) => {
  try {
    const response = await api.get(
      withToken(`/fixtures?date=${date}`)
    );

    return response.data;
  } catch (error) {
    console.error(
      "Sportmonks Fixtures Error:",
      error.response?.data || error.message
    );

    return { data: [] };
  }
};

// ⚽ Standings
export const getStandings = async (leagueId) => {
  try {
    const response = await api.get(
      withToken(`/standings?league_id=${leagueId}`)
    );

    return response.data;
  } catch (error) {
    console.error(
      "Sportmonks Standings Error:",
      error.response?.data || error.message
    );

    return { data: [] };
  }
};
