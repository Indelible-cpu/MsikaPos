import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Request, Response } from 'express';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ 
      success: true, 
      data: text || "The brain is thinking... but no words came out. Try again." 
    });
  } catch (error: any) {
    console.error('Gemini AI Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Msika Brain failed to generate suggestion', 
      error: error.message,
      details: 'Ensure GEMINI_API_KEY is set in Render environment variables'
    });
  }
};
