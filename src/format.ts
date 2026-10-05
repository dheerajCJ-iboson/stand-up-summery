export type OutputFormat = "markdown" | "slack" | "plain";

export function parseFormat(input: string | undefined): OutputFormat {
  const v = (input ?? "").trim().toLowerCase();
  if (v === "slack" || v === "plain" || v === "markdown") return v;
  return "markdown";
}

export function formatSummary(markdown: string, format: OutputFormat): string {
  switch (format) {
    case "slack":
      return markdown.replace(/\*\*(.+?)\*\*/g, "*$1*").replace(/^(\s*)[-*] /gm, "$1• ");
    case "plain":
      return markdown.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`/g, "");
    default:
      return markdown;
  }
}

export async function postToSlack(webhookUrl: string, text: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}: ${await res.text()}`);
}
