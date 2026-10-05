export interface LlmProvider {
  /** Display name, e.g. "gemini:gemini-2.5-flash". */
  readonly label: string;
  generate(prompt: string): Promise<string>;
}
