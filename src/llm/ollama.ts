import type { LlmProvider } from "./types.ts";

/**
 * Talks to an Ollama server (local daemon by default). Cloud models such as
 * `gemma4:31b-cloud` work through the local daemon after `ollama signin`.
 * To call ollama.com directly, set OLLAMA_HOST=https://ollama.com and OLLAMA_API_KEY.
 */
export function createOllamaProvider(
  host: string,
  modelName: string,
  apiKey?: string,
): LlmProvider {
  const base = host.replace(/\/+$/, "");
  return {
    label: `ollama:${modelName}`,
    async generate(prompt) {
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: modelName,
          stream: false,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Ollama ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      return data?.message?.content ?? "";
    },
  };
}
