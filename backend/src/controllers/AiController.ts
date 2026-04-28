import OpenAI from 'openai';
import type { Request, Response } from 'express';

let _openai: OpenAI | null = null;
const getOpenAI = () => {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'missing',
      baseURL: "https://api.x.ai/v1",
    });
  }
  return _openai;
};

export const getAiSuggestions = async (req: Request, res: Response) => {
  const { context, type } = req.body;

  if (!process.env.OPENAI_API_KEY) {
    return res.json({ 
      success: true, 
      data: "Msika Brain (Grok Edition) is currently in demo mode. Please configure your xAI API Key in the system settings." 
    });
  }

  try {
    let prompt = "";

    if (type === 'DASHBOARD_INSIGHTS') {
      prompt = `You are a professional business consultant for a retail POS system called MsikaPos. 
      Given the following sales and inventory data, provide 3 powerful, actionable business suggestions to improve profit, manage stock better, or increase customer retention. 
      Keep it concise, professional, and data-driven. 
      Data: ${JSON.stringify(context)}`;
    } else if (type === 'INVENTORY_STRATEGY') {
      prompt = `Review this inventory list and suggest which items should be discontinued, which should be restocked urgently, and suggest a pricing strategy adjustment for slow-moving items. 
      Data: ${JSON.stringify(context)}`;
    } else if (type === 'SYSTEM_DIAGNOSTICS') {
      prompt = `You are Msika Guard, a technical system engineer for MsikaPos. 
      Analyze the following system audit logs and diagnostic info to identify potential issues, security risks, or performance bottlenecks. 
      Provide a technical summary and troubleshooting steps for the Super Admin.
      Logs/Info: ${JSON.stringify(context)}`;
    } else {
      prompt = `Provide a powerful business idea or suggestion based on this context: ${JSON.stringify(context)}`;
    }

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "grok-2", // Standard production model
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    });

    res.json({ 
      success: true, 
      data: response.choices[0]?.message?.content || "The brain is thinking... but no words came out. Try again." 
    });
  } catch (error: any) {
    console.error('AI Error Deep Trace:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'AI failed to generate suggestion', 
      error: error.message,
      details: error.response?.data || 'Check xAI API status or key usage'
    });
  }
};
