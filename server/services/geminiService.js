import axios from "axios";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

export const callGemini = async (prompt) => {
  try {
    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY,
        },
        timeout: 60000, // ⬅️ increase timeout
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Gemini API Error:",
      error.response?.data || error.message
    );

    // ✅ VERY IMPORTANT: fallback response
    return {
      fallback: true,
      prediction: "AI unavailable",
      confidence: 0,
    };
  }
};
