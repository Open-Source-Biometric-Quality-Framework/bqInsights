# OpenBQ Desktop User Manual

Welcome to the OpenBQ Desktop user manual. This guide is designed for non-expert users who want to perform meaningful biometric quality analysis without needing a deep data science background.

OpenBQ Desktop can feel technical at first because it combines data loading, visual exploration, clustering, and AI-assisted interpretation in one workspace. This manual breaks those topics into practical steps you can follow in order.

As you work through these guides, focus on understanding the purpose behind each feature, not just which button to press. The strongest results come when you connect tool behavior to your operational goals.

This documentation is for **OpenBQ Desktop** (the application). The lower-case **openbq** project is the underlying biometric quality assessment framework used by the desktop app.

> [!TIP]
> **Things to Think About**
> - What business or operational decision should this analysis support?
> - What would a "useful" finding look like for your team?
> - How will you validate AI-generated suggestions before acting on them?

## Scenario Examples

### Scenario A: New analyst onboarding
A new analyst has never used OpenBQ Desktop before and needs to run a first quality review safely.  
They should follow the manual in order, starting with setup, then interface/data loading, then analysis.

### Scenario B: Team handover
An analyst is leaving for two weeks and needs someone else to continue the work.  
Using this manual plus exported analysis bundles helps the next person reproduce the workflow quickly.

```mermaid
flowchart LR
  A["Start Here"] --> B["Setup"]
  B --> C["Load Data"]
  C --> D["Run Analysis"]
  D --> E["Use AI Carefully"]
  E --> F["Tune Advanced Settings (Optional)"]
```

## How to Use This Manual

If you are new to OpenBQ Desktop, follow this order:

1. [Setup and First Run](/Users/ted/dev/biometix-electron/packages/openbq-desktop/docs/01-setup-and-first-run.md)
2. [Interface Tour and Data Loading](/Users/ted/dev/biometix-electron/packages/openbq-desktop/docs/02-interface-tour-and-data-loading.md)
3. [Analysis Workflow](/Users/ted/dev/biometix-electron/packages/openbq-desktop/docs/03-analysis-workflow.md)
4. [Using AI Assistance](/Users/ted/dev/biometix-electron/packages/openbq-desktop/docs/04-ai-assistance.md)
5. [Advanced Customization](/Users/ted/dev/biometix-electron/packages/openbq-desktop/docs/05-advanced-customization.md)

## What OpenBQ Desktop Helps You Do

OpenBQ Desktop helps you:

- Load biometric quality datasets from folders, CSV/XLSX files, or analysis archives.
- Visualize data structure using UMAP (a 2D map of complex data relationships).
- Detect clusters and outliers that may indicate quality patterns or operational issues.
- Drill down from group-level patterns to individual sample details.
- Use AI tools to summarize findings and produce plain-language explanations.

## Important Notes

- OpenBQ Desktop uses local processing workflows and depends on Docker for key analysis functions.
- AI-assisted features depend on an AI backend (Ollama/OpenAI/Claude/Apple, depending on your setup).
- First-time startup can take longer while models/containers are prepared.
