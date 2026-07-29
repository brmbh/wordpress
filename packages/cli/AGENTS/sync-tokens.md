# /sync-tokens

Fetch design tokens from the Figma file via Claude MCP and regenerate `assets/src/scss/_tokens.scss`. No Figma personal access token required — uses the Figma MCP server already connected to this session.

## When to use this vs `wp brmbh tokens`

| | `/sync-tokens` (this skill) | `wp brmbh tokens` |
|---|---|---|
| Requires | Figma MCP active in Claude session | Figma personal access token in `.brmbh-config.json` |
| Best for | Interactive dev sessions (you're already in Claude Code) | Automation / CI / outside Claude |

## Workflow

1. **Read Figma variables** via `mcp__claude_ai_Figma__get_variable_defs`:
   - fileKey: from `.brmbh-config.json` (`figmaFileKey`), or ask the user
   - nodeId: the frame/collection that holds the variables (ask the user)

2. **Transform** the JSON output to CSS custom properties using this mapping:

   **Colors** (any key containing "color" or with hex value):
   ```
   Brand/Color/Primary → --brand-color-primary: #2563eb;
   ```

   **Spacing** (numeric values, keys matching xxs/xs/s/m/l/xl/xxl/edge):
   ```
   m → --space-m: 24px;
   edge → --space-edge: 84px;
   ```

   **Corners** (numeric values, keys containing "corners"):
   ```
   Corners M → --corners-m: 24px;
   ```

   Skip: typography tokens (Font(...) strings) — those are in `_variables.scss`.

3. **Write** `assets/src/scss/_tokens.scss` with this header:
   ```scss
   // DESIGN TOKENS — generated via Figma MCP
   // Source: figma.com/design/<your-file-key>
   // Do NOT edit manually — run /sync-tokens to regenerate.
   ```

4. **Run** `npm run build:css` to recompile.

5. **Report** what changed vs the previous file (new tokens added, values changed, tokens removed).

## Rules

- Never add tokens not present in Figma — don't invent values
- Preserve the existing file structure (color group → spacing group → corners group)
- Do not edit `_variables.scss` — that's where Bootstrap variable overrides live (separate concern)
- If a token name maps ambiguously, prefer the more specific CSS var name
