import axios from "axios";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

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
        timeout: 20000, // ⬅️ increase timeout (20s)
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Gemini API Error:",
      error.response?.data || error.message
    );

    // ✅ graceful fallback (CRITICAL for your app)
    return {
      fallback: true,
      message: "AI temporarily unavailable",
    };
  }
};
