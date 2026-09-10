# Repository instructions

Before changing this repository:

1. Read `RESEARCH_SPEC.md` completely.
2. Read `DESIGN.md` completely.
3. Read `ARCHITECTURE.md` completely.
4. Inspect the existing implementation and generated data manifest.

Scientific rules:

- Never fabricate, interpolate, or silently recalculate research results.
- Never retrain the model or alter research methodology without explicit instruction.
- Preserve predictive, non-causal SHAP language.
- Distinguish the modeled `state_puma` feature from descriptive approximate-county summaries.
- Every county result must retain its overlap and reliability context.
- Prefer the deterministic exporter over hand-copying research values.
- Raw ACS microdata must not be bundled into the web application.
- Phase 3 inference must load the checked-in exact Method 2B artifact; do not substitute coefficients, retune, or refit during a user request.
- Keep SHAP in native log1p output units and verify local additivity before presenting an explanation.
- Treat ZIP input as a Census ZCTA lookup resolved to State–PUMA; never imply ZIP, ZCTA, county, and PUMA are equivalent.

Product rules:

- Keep exactly six primary destinations: Overview, Explore, Estimate, Drivers, Model, Research.
- Reuse the unified analytical application shell on every primary route; `/evaluate` is compatibility-only.
- Maintain the editorial visual system in `DESIGN.md` and avoid generic AI/SaaS patterns.
- Use human-readable labels in the interface; internal feature names belong in methodology/detail views.
- Do not introduce authentication, a database, workers, or unrelated product concepts without a concrete approved need.
- Preserve the local-only privacy boundary: no names, emails, street addresses, request persistence, or third-party property lookups.

Quality rules:

- Add or update scientific consistency tests with data-layer changes.
- Run formatter check, lint, TypeScript typecheck, tests, and production build before completion.
- Do not suppress genuine failures.
