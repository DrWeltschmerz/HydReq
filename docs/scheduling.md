# Scheduling

HydReq supports two ways to control order:

## Stages
- Integer `stage` groups tests that can run concurrently.
- Variables extracted in a stage are available to later stages.

## dependsOn (DAG)
- `dependsOn: ["producer test name"]` forms a DAG.
- Scheduler resolves layers, skipping dependents when producers fail or are filtered.
- Ensure test names are unique when using `dependsOn`.
