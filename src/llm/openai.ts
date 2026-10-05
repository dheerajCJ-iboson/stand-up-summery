import type { LlmProvider } from "./types.ts";

/** Any OpenAI-compatible chat completions endpoint (OpenAI, OpenRouter, vLLM, LM Studio...). */
export function createOpenAiProvider(
  baseUrl: string,
  modelName: string,
  apiKey: string,
): LlmProvider {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    label: `openai:${modelName}`,
    async generate(prompt) {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        throw new Error(`OpenAI-compatible API ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      return data?.choices?.[0]?.message?.content ?? "";
    },
  };
}
