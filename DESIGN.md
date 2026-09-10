# Design system

## Character

The interface is an editorial research product: calm, analytical, and data-forward. Typography and visual evidence create hierarchy; the chrome stays quiet. It must not resemble a generic SaaS dashboard.

## Typography

- Display and editorial headings: Georgia with system serif fallbacks.
- Interface and body: Arial/Helvetica/system sans-serif.
- Tabular values: tabular numerals.
- Headings use compact line-height and moderate weight; body copy stays between 16–19px on reading surfaces.

## Color

- Ink: `#18201d`
- Muted ink: `#626b66`
- Paper: `#f5f2eb`
- Surface: `#fffdf8`
- Rule: `#d8d2c5`
- Primary data accent: forest `#176b55`
- Secondary data accent: ochre `#b06f24`
- Diverging negative: brick `#a14f43`
- Reliability: green for higher confidence, ochre for moderate overlap, brick outline for low sample. Text or pattern always accompanies color.

Avoid gradients, neon, purple/blue AI styling, and decorative color. Chart colors must have a semantic role.

## Layout and spacing

- Maximum reading width: 1,240px; long-form copy: 720px.
- Twelve-column desktop grid; stacked single-column reading flow on small screens.
- Section spacing: 72–112px desktop, 48–72px mobile.
- Thin rules and tonal fields separate content; cards are reserved for interactive or comparable units.
- Corners are restrained (0–12px). Shadows are rare and subtle.

## Navigation and controls

The compact header contains exactly five primary destinations: Overview, Explore, Drivers, Model, Research. Active state uses weight and an underline, not a filled pill. Controls use visible labels, strong keyboard focus, and minimum 44px touch targets.

The `/evaluate` analytical workspace is entered from a clear public-page CTA. Inside it, the public header is replaced by a collapsible dark sidebar, a progressive context bar, a wide evidence canvas, and an optional detail panel. On mobile the sidebar becomes a drawer. A persistent “Back to research” link preserves the transition to the public editorial site.

## Charts

- Charts begin with a research question, not a decorative title.
- Axes show units; numeric tooltips repeat the measure and scientific caveat where needed.
- Horizontal bars are used for ranked importance.
- Sequential green tones encode magnitude; brick/green encode signed SHAP direction around zero.
- `state_puma` is visually separated from non-geographic drivers.
- Every chart includes an accessible text/table alternative or aria-labelled summary.

## Map

The map uses actual state, county, and 2020 State-PUMA boundary files. State selection drills into counties; the level control switches to the directly modeled PUMA geography. Approximate county layers expose reliability, overlap, record count, and effective sample size and never imply exact household location.

## Responsive behavior

Visualizations stack below 840px. Dense comparison tables gain horizontal scrolling without hiding columns. Maps and charts retain labels and accessible summaries rather than disappearing.

## Motion

Use only short opacity/position transitions for focus, hover, and selection. Respect `prefers-reduced-motion`. No ambient or ornamental animation.

## Accessibility

Use semantic landmarks, skip navigation, visible focus outlines, minimum WCAG AA contrast, non-color reliability labels, descriptive link text, and screen-reader summaries for charts and maps.

## Explicit anti-patterns

No giant marketing hero, glassmorphism, excessive rounded cards, statistic-card grids, chatbot widgets, AI sparkles, emoji navigation, cartoon maps, unnecessary sidebars, or unsupported scientific decoration.
