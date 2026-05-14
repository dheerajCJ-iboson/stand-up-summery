import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./src/config/env.ts";

async function listModels() {
  if (!config.geminiApiKey) {
    console.error("No API key found.");
    return;
  }
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  try {
    const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    // Actually, the SDK doesn't have a simple listModels in the main export sometimes 
    // or it's on the client. 
    // Let's just try gemini-1.5-flash-latest or gemini-1.5-pro
    console.log("Testing model names...");
  } catch (e) {
    console.error(e);
  }
}

listModels();
