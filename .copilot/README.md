# Copilot configuration for HydReq YAML suites

This folder provides guidance and structure hints so Copilot can help author YAML suites for HydReq effectively.

Contents:
- `prompts/suite.prompts.md`: Authoring guide with schema/idioms and examples. Open this alongside your YAML to steer Copilot.
- `../schemas/suite.schema.json`: JSON Schema for the suite format (also available at https://raw.githubusercontent.com/DrWeltschmerz/HydReq/main/schemas/suite.schema.json). Configure your editor to use it for validation and completions.

## Recommended VS Code settings

Add this to your workspace `.vscode/settings.json` to validate YAML with the schema and improve completions:

```json
{
  "yaml.schemas": {
    "./schemas/suite.schema.json": [
      "testdata/*.yaml",
      "**/suite*.yaml",
      "**/*qa*.yaml"
    ]
  }
}
```

Tips:
- Keep `prompts/suite.prompts.md` open in a split pane while writing suites so Copilot picks up the conventions and examples.
- Run `hydreq` with no arguments to launch the Web UI for quick feedback while authoring.
