/**
 * MsikaPos AI Service
 * Handles communication with xAI (Grok) API
 */

const MODEL = process.env.XAI_MODEL || "grok-beta";
const BASE_URL = `https://api.x.ai/v1/chat/completions`;

export const aiService = {
  /**
   * Generates content using xAI
   */
  async generate(prompt: string, _context?: any) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("[AI Service] Error: OPENAI_API_KEY is not set in environment.");
      throw new Error("AI_CONFIG_ERROR");
    }

    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: "You are Msika Brain, a professional and highly intelligent AI business assistant for MsikaPos. Provide concise, actionable, and analytical responses."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[AI Service] xAI API Error:", errorData);
        throw new Error(`AI_API_ERROR: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract text from response
      const text = data.choices?.[0]?.message?.content;
      
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
