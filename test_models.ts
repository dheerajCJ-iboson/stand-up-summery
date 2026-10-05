// Quick check that the configured LLM provider responds: `deno run -A test_models.ts`
import { config } from "./src/config/env.ts";
import { createLlmProvider } from "./src/llm/index.ts";

const llm = createLlmProvider();
console.log(`Testing ${llm.label} ...`);
try {
  console.log(await llm.generate("Reply with the single word: ok"));
} catch (e) {
  console.error(`Failed (${config.llm.provider}):`, (e as Error).message);
}
