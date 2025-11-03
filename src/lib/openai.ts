import OpenAI from "openai";
import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  openaiApiKey: string;
}

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const preferences = getPreferenceValues<Preferences>();
    openaiClient = new OpenAI({
      apiKey: preferences.openaiApiKey,
    });
  }
  return openaiClient;
}

