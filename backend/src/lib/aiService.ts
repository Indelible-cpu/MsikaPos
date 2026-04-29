/**
 * MsikaPos AI Service
 * Handles communication with Google Gemini API
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest";
const API_VERSION = "v1beta";
const BASE_URL = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL}:generateContent`;

export const aiService = {
  /**
   * Generates content using Gemini AI
   */
  async generate(prompt: string, _context?: any) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("[AI Service] Error: GEMINI_API_KEY is not set in environment.");
      throw new Error("AI_CONFIG_ERROR");
    }

    try {
      const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[AI Service] Gemini API Error:", errorData);
        throw new Error(`AI_API_ERROR: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract text from response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        console.warn("[AI Service] Warning: Empty response from AI.");
        return null;
      }

      return text;
    } catch (error) {
      console.error("[AI Service] Internal Exception:", error);
      throw error;
    }
  }
};
