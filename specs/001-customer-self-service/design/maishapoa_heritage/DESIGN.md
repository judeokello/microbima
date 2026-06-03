# Design System Specification

## 1. Overview & Creative North Star: "The Empathetic Anchor"

This design system is engineered to bridge the gap between clinical security and human-centric warmth. We are moving away from the "standard SaaS" aesthetic to create **"The Empathetic Anchor"**—a visual language that feels as stable as a financial institution but as accessible as a community center.

Instead of a rigid, boxy layout, we utilize **Intentional Asymmetry** and **Tonal Depth**. By overlapping elements and utilizing a high-contrast typography scale (pairing the geometric authority of Plus Jakarta Sans with the high-readability of Inter), we create an editorial feel. The interface shouldn't just be "used"; it should be "navigated" like a premium journal, where white space acts as a structural element rather than a void.

---

## 2. Colors: Depth Over Definition

Our palette is rooted in deep purples for authority and vibrant oranges for energy. However, the sophistication lies in how these colors interact without traditional borders.

### The "No-Line" Rule
Explicitly prohibit 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section should sit directly against a `surface` background. This creates a seamless, modern flow that feels built rather than drawn.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the surface tiers to create "nested" depth:
- **Base Layer:** `surface` (#f9f9fd)
- **Content Blocks:** `surface-container-low` (#f3f3f7)
- **Action Cards:** `surface-container-lowest` (#ffffff) to provide a soft, natural lift.

### The "Glass & Gradient" Rule
To move beyond a flat appearance, use **Glassmorphism** for floating elements (headers, navigation bars, or modals). Apply semi-transparent surface colors with a `backdrop-blur` of 12px–20px. 
*   **Signature Texture:** Use a subtle linear gradient transitioning from `primary` (#480054) to `primary-container` (#631c6e) for main CTAs. This provides a "soul" and professional polish that flat fills cannot achieve.

---

## 3. Typography: The Editorial Voice

We use a dual-font strategy to balance character with clarity.

*   **Display & Headlines (Plus Jakarta Sans):** These are our "Brand Statements." Use large scales (`display-lg` at 3.5rem) with tight letter-spacing to convey authority and modernism.
*   **Body & Labels (Inter):** These are our "Information Carriers." Inter provides maximum readability at small scales, ensuring accessibility is never sacrificed for style.

**Hierarchy Strategy:**
- **Display-LG/MD:** For hero sections and major impact statements.
- **Title-LG/MD:** For card headers, using the `primary` color to anchor the user's eye.
- **Body-MD:** The workhorse for all descriptive content, set in `on-surface-variant` (#4f434e) to reduce eye strain compared to pure black.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are often a crutch for poor layout. In this system, we prioritize **Tonal Layering**.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. The subtle shift in hex value provides enough contrast for the human eye to perceive depth without the "noise" of a shadow.
*   **Ambient Shadows:** When a "floating" effect is required (e.g., a primary action button or a modal), use an extra-diffused shadow:
    - **Blur:** 24px–40px
    - **Opacity:** 4%–8%
    - **Color:** Use a tinted version of `on-surface` (#1a1c1f) rather than pure black to mimic natural light.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, it must be a "Ghost Border": use `outline-variant` at 15% opacity. Never use 100% opaque borders.

---

## 5. Components: Refined Primitives

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`) with `on-primary` text. Radius: `md` (0.75rem).
- **Secondary:** Surface-tinted. Use `secondary-fixed` background with `on-secondary-fixed` text.
- **Interactive State:** On hover, increase the background saturation rather than darkening it.

### Cards & Lists
- **Rule:** Forbid the use of divider lines. 
- **Execution:** Separate list items using `1rem` of vertical white space or by alternating background shifts between `surface-container-low` and `surface-container`.
- **Shape:** Use `lg` (1rem) corner radius for cards to maintain the "modern and accessible" feel.

### Input Fields
- **Background:** `surface-container-highest` (#e2e2e6).
- **Border:** None, unless focused. On focus, use a `2px` "Ghost Border" of `primary`.
- **Label:** Always use `label-md` in `on-surface-variant` for persistent visibility.

### Selection Elements (Chips & Radio)
- Use the `secondary` (#a73a00) and `secondary-container` (#ff6a27) tokens here. Orange is used sparingly as a "Highlight" color to draw attention to selection states and notifications.

---

## 6. Do's and Don'ts

### Do:
- **Do** use asymmetrical padding (e.g., more top padding than bottom in a hero section) to create a custom, editorial feel.
- **Do** use `backdrop-blur` on navigation components to allow brand colors to bleed through as the user scrolls.
- **Do** prioritize white space over lines. If the layout feels "messy," add more space, not more borders.

### Don't:
- **Don't** use pure black (#000000) for text. Always use `on-surface` or `on-surface-variant`.
- **Don't** use the `secondary` orange for large background areas. It is an accent tool, not a foundation.
- **Don't** use "Standard" 4px rounded corners. Use our `md` (12px) or `lg` (16px) scales to ensure a softer, more modern approachable aesthetic.

---

## 7. Customer portal extensions

### Phone masking (customer portal)

For the deep-link sign-in screen (**FR-001a**, **`/self/customer/:customerId`**):

- **Input**: Canonical national mobile stored or normalized to **10 digits** starting with `07` (Kenya MSISDN in national format).
- **Display**: Show literal **`07`**, then **five** masking characters **`•`** (U+2022 bullet), then the **last four** digits of the number unchanged.
- **Example**: `0712345678` → displayed as **`07•••••5678`**.

Never show the full MSISDN in clear text on this screen. APIs and OpenAPI examples MUST use this pattern for sample values.