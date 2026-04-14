# Design System — Onchain Pulse

## Product Context
- **What this is:** DeFi portfolio dashboard for the Monad blockchain
- **Who it's for:** Monad community members tracking their positions
- **Space:** DeFi dashboards (Zapper, DeBank, Zerion)
- **Project type:** Dark-theme web app / data dashboard

## Aesthetic Direction
- **Direction:** Industrial-premium
- **Decoration level:** Intentional (glassmorphism, subtle glow, no decorative elements)
- **Mood:** Bloomberg meets modern fintech. Data-dense, confident, trustworthy. Every pixel earns its place.

## Typography
- **Display/Hero:** Satoshi (via fontshare.com) — geometric, modern, distinctive without being trendy
- **Body:** Satoshi — same family for cohesion, weight contrast creates hierarchy
- **Data/Tables:** JetBrains Mono — tabular-nums for financial data, no digit wobble
- **Loading:** Fontshare CDN (Satoshi) + Google Fonts (JetBrains Mono)
- **Scale:** 11px / 13px / 15px / 20px / 28px — five sizes, clear roles

| Size | Token | Role |
|------|-------|------|
| 11px | text-xs | Labels, captions, timestamps |
| 13px | text-sm | Secondary info, table cells, badges |
| 15px | text-base | Body text, card titles, nav items |
| 20px | text-lg | Stat values, section headers |
| 28px | text-xl | Hero numbers, page titles |

## Color
- **Approach:** Restrained with one warm accent
- **Background:** #0D0B1A (deep navy-black)
- **Cards L1:** rgba(255,255,255,0.03) — default containers
- **Cards L2:** rgba(255,255,255,0.05) — elevated (stat cards, active elements)
- **Text primary:** #EEEEF2 (warm off-white)
- **Text secondary:** #A0A0B8
- **Text muted:** #5A5A74
- **Text dim:** #3A3A54
- **Accent primary:** #6D3BF5 (indigo — brand, CTAs, focus rings)
- **Accent secondary:** #D4C5A0 (warm gold — premium accent, gradient partner)
- **Accent tertiary:** #A78BFA (light violet — data highlights)
- **Positive:** #14B8A6 (teal green — gains, APY, success)
- **Negative:** #F87171 (soft red — losses, errors, risk)
- **Warning:** #F59E0B (amber)
- **Brand gradient:** linear-gradient(135deg, #6D3BF5, #D4C5A0) — indigo to gold

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Common values:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64

## Layout
- **Max content width:** 920px
- **Card gap:** 12px (gap-3)
- **Section gap:** 24px (gap-6)

## Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | 4px | Small elements, badges, focus rings |
| radius-md | 8px | Buttons, inputs, tabs |
| radius-lg | 12px | Cards, modals, dropdowns |

## Motion
- **Approach:** Intentional
- **Easing:** ease-out for entering, ease-in for exiting
- **Durations:** 150ms (micro), 200ms (transitions), 300ms (entrances)
- **Card entrance:** fade-up with 50ms stagger
- **Tab transitions:** 120ms opacity fade
- **Logo:** 4s gradient shift loop

## Card Elevation System
| Level | Background | Border | Shadow | Usage |
|-------|-----------|--------|--------|-------|
| 0 | bg-primary | none | none | Page background |
| 1 | card | border | inset glow | Default containers, tables |
| 2 | card-elevated | border-elevated | inset glow + drop shadow | Stat cards, active elements |

## Anti-patterns (never use)
- Colored left-border on cards
- Purple/violet gradient backgrounds
- 3-column feature grids with icon circles
- Centered everything
- Decorative blobs or wavy dividers
- Uniform border-radius on all elements
- DM Sans, Inter, Roboto, or other overused fonts as primary

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-14 | Satoshi over DM Sans | More character, geometric, not overused in dashboards |
| 2026-04-14 | Gold accent over teal | Teal felt startup-template. Gold adds warmth and premium feel |
| 2026-04-14 | 5-size type scale | 10 arbitrary sizes created visual noise. 5 clear roles. |
| 2026-04-14 | 3-level card elevation | Single card style felt flat. Elevation creates depth hierarchy |
| 2026-04-14 | 3-tier border radius | Uniform 14px was lazy. 4/8/12px hierarchy matches element scale |
