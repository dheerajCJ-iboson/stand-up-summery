# Git Stand-up Summery Tool

A robust Deno-based CLI tool that fetches your git commits for a specific day and uses Google Gemini 1.5 Flash to generate a professional stand-up summary.

## Prerequisites

- [Deno](https://deno.com/) installed on your machine.
- A Google Gemini API Key (get one at [Google AI Studio](https://aistudio.google.com/)).

## Setup

1. **Clone/Download** this repository.
2. **Configure Environment Variables**:
   Duplicate the `.env.example` file and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   You can also set a default author and repository path in this file.

## Running the Tool

You can run the tool using the pre-defined Deno tasks:

### 1. Run for Today (Defaults)
This fetches commits for the current date from the current directory.
```bash
deno task start
```

### 2. Run for a Specific Date
Use the `--date` or `-d` flag (format: `dd-mm-yyyy`).
```bash
deno task start --date 13-04-2026
```

### 3. Run for a Specific Repository
Use the `--path` or `-p` flag.
If the path is a parent folder containing multiple git repositories, the tool will scan nested repositories up to 4 levels deep by default.
```bash
deno task start --path "~/Projects/my-parent-folder"
```

### 4. Control Search Depth
Use the `--depth` or `-l` flag to adjust how many folder levels are scanned for nested git repositories.
```bash
deno task start --path "~/Projects" --depth 4
```

### 5. Run for a Specific Author
Use the `--author` or `-a` flag.
```bash
deno task start --author "Your Name <email@example.com>"
```

### Mixing Arguments
You can combine any of the flags:
```bash
deno task start -d 15-04-2026 -p "./my-project" -a "Dheeraj"
```

## How It Works

1. **Git Fetch**: The tool runs `git log` behind the scenes to find all commits you made on the specified day.
2. **AI Processing**: It sends the commit messages to Gemini 1.5 Flash with a specialized prompt to categorize and summarize your work.
3. **Output**: It generates a text file named `dd-mm-yyyy-summery.txt` (e.g., `16-04-2026-summery.txt`) containing the final report.

## Folder Structure

- `src/cli.ts`: Argument parsing and tool orchestration.
- `src/git.ts`: Git command execution logic.
- `src/gemini.ts`: Google Generative AI integration.
- `src/config/env.ts`: Environment and configuration management.
- `deno.json`: Task definitions and dependencies.
