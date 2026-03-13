---
name: ui-ux-pro-max
description: "Use when: redesigning frontend UI, improving homepage visual quality, adding carousel/animation/background effects, refining UX copy and information hierarchy for React/Next.js pages."
---

# UI/UX PRO MAX Skill (Local)

## Goal
Upgrade pages from "usable" to "premium" while keeping performance, readability, and mobile experience stable.

## Inputs To Confirm
- Target page and primary business goal.
- Audience and tone (e.g. modern, premium, bold, calm).
- Visual intensity level (subtle / medium / vivid).
- Existing design constraints and brand elements.

## Workflow
1. Baseline audit
- Identify hero, CTA, trust area, comparison/demo area, and information modules.
- Find weak points in hierarchy, spacing rhythm, and visual focus.

2. Structure redesign
- Keep core user path obvious: value proposition -> proof -> action.
- Group content into clear sections with consistent vertical rhythm.

3. Motion system
- Add purposeful animation only: hero reveal, staggered cards, carousel transitions.
- Use long-cycle background motion, avoid noisy micro animations.
- Respect reduced-motion preference when practical.

4. Visual language
- Define color tokens and contrast strategy first.
- Replace flat background with layered gradient and soft glow shapes.
- Use card depth (border, blur, shadow, highlight) to create hierarchy.

5. Content UX
- Ensure headline states value in one sentence.
- Keep support copy concise and specific.
- Add "why it works" section with plain language and technical proof.

6. Responsive and performance
- Mobile-first stacking for dense sections.
- Avoid hard-coded oversized widths causing overflow.
- Limit simultaneous animation count to keep frame stability.

## Output Checklist
- Updated page structure and section order are clear.
- Hero area has improved emotional impact and clarity.
- Background is non-flat and visually consistent.
- At least 2-3 meaningful animations are implemented.
- Added project introduction section (origin, mechanism, value).
- Desktop/mobile both render without clipping or overlap.

## Anti-Patterns
- Do not add animation everywhere.
- Do not reduce readability for style.
- Do not introduce unrelated dependencies if existing stack is sufficient.
- Do not change backend contracts for visual tasks.

## For This Repository
- Primary target: roomGPT_frontend/app/page.tsx
- Style root: roomGPT_frontend/styles/globals.css
- Reuse components when possible: SquigglyLines, Header, Footer
- Keep API behavior unchanged for homepage-only redesign
