---
name: create-prompt
description: "Create a reusable `.prompt.md` from a conversation or selected context. Extracts patterns, clarifies ambiguities, and drafts a polished prompt file with examples."
applyTo: "**/*"
---

Overview
- Purpose: Given a conversation or selected code/context, produce a reusable `.prompt.md` that encodes the repeatable task.
- Output: A complete prompt file (YAML frontmatter + body) suitable for placing under `.github/prompts/` or the user's prompts folder.

Instructions for the agent
1. Review the given conversation history or selected content and identify whether a repeatable task exists.
2. If a pattern exists, extract:
   - Core task being repeated (one concise sentence)
   - Implicit inputs (e.g., selected file, language, code block)
   - Desired output format (e.g., unit tests, refactor, summary)
3. If no clear pattern emerges, produce a short set of clarifying questions (2–4) to ask the user.
4. Draft a `.prompt.md` including:
   - YAML frontmatter (`name`, `description`, optional `applyTo`)
   - A short `Use when:` guidance with trigger phrases
   - `Inputs:` schema (names, types, defaults)
   - `Steps:` the agent should follow when executing the prompt
   - `Output:` exact format to return
   - At least two example invocations with sample inputs and expected outputs
5. Highlight ambiguous or opinionated choices and list them as questions for the user.

Output format
- Return only the complete `.prompt.md` file content as the primary artifact.

Examples
- Example invocation 1: "Create a prompt to auto-generate unit tests for a selected JS function." 
- Example invocation 2: "Create a prompt to summarize changes in a git diff and produce a changelog entry."

Placement recommendation
- Workspace-shared prompts → `.github/prompts/`
- Personal prompts → user prompts folder (e.g., `c:\Users\<you>\AppData\Roaming\Code\User\prompts/`)

"Use when" trigger suggestions
- "create prompt", "extract prompt", "make reusable prompt", "prompt template for repeatable task"

---

# Notes for the author
- If the conversation includes file paths or selection context, reference those explicitly in `Inputs`.
- Keep the `description` short and include likely trigger phrases so the agent can discover the prompt.
