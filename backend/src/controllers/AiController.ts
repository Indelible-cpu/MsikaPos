import type { Request, Response } from 'express';
import { aiService } from '../lib/aiService';

export const getAiSuggestions = async (req: Request, res: Response) => {
  const { context, type } = req.body;

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

    const text = await aiService.generate(prompt, context);

    res.json({ 
      success: true, 
      data: text || "Msika Brain is thinking... but no words came out. Please try again." 
    });
  } catch (error: any) {
    console.error('Msika Brain Error:', error);
    
    // Controlled error message for user safety
    let userMessage = "AI service temporarily unavailable. Please try again.";
    
    if (error.message === 'AI_CONFIG_ERROR') {
      userMessage = "Msika Brain is currently in demo mode. Please configure your GEMINI_API_KEY.";
    }

    return res.status(error.message === 'AI_CONFIG_ERROR' ? 200 : 500).json({ 
      success: error.message === 'AI_CONFIG_ERROR', 
      message: userMessage,
      data: error.message === 'AI_CONFIG_ERROR' ? userMessage : undefined
    });
  }
};
