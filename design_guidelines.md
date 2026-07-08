# Design Guidelines: RevolRMO Financial Management

## Design Philosophy

**Modern Minimalist Dashboard**: Clean, elegant interface inspired by modern SaaS products (Linear, Stripe, Notion). Focus on whitespace, subtle shadows, and clear information hierarchy. Color palette: White, Light Grey, and Blood Red (#C22828) accents.

---

## Core Design Principles

1. **Generous Whitespace**: Give elements room to breathe - p-6 for sections, gap-6 between major components
2. **Subtle Elevation**: Use very soft shadows and subtle borders - avoid heavy drop shadows
3. **Clear Hierarchy**: Large stat numbers, medium labels, small supporting text
4. **Consistent Rhythm**: Use 4, 6, 8, 12 spacing units consistently throughout

---

## Brand Colors

**Primary**: Blood Red (#C22828) - `0 85% 38%` in HSL
**Background**: Pure White (#FFFFFF) - clean and bright
**Secondary**: Light Grey (#F0F0F0) - subtle contrast for cards/panels
**Neutral**: Clean grays for text hierarchy
**Destructive**: Same blood red for consistency

---

## Typography

**Font Family**: Inter (system-ui fallback)

**Scale**:
- Stat Numbers: text-4xl to text-5xl, font-bold (42px-60px)
- Page Titles: text-2xl, font-semibold
- Section Headers: text-lg, font-medium
- Body/Labels: text-sm, font-normal
- Meta/Captions: text-xs, text-muted-foreground

---

## Layout System

### Sidebar
- **Width**: 16-18rem (256-288px)
- **Structure**: 
  - Logo + brand name at top (p-4)
  - Optional search bar below logo
  - Navigation groups with subtle labels
  - User profile section at bottom with avatar

### Navigation Items
- Icon + label pattern
- Subtle hover states (bg-muted/50)
- Active state with bg-accent
- Optional badge counts aligned right

### Dashboard Grid
- 2-3 large stat cards per row
- Use CSS Grid with gap-6
- Cards should have generous internal padding (p-6)

---

## Component Patterns

### Stat Cards (KPI Cards)
```
+----------------------------------+
|  [Icon]           [Trend Badge]  |
|                                  |
|  Label text (small, muted)       |
|  $245,000  (4xl-5xl, bold)       |
|                                  |
|  +12% from last month (small)    |
+----------------------------------+
```
- Large rounded corners (rounded-xl)
- Subtle border or soft shadow
- Icon in muted color, top-left
- Optional trend indicator

### Chart Cards
- Full-width or half-width in grid
- Title at top, minimal controls
- Chart fills remaining space
- Clean axis labels, subtle gridlines

### Tables
- Clean header row with subtle background
- Alternating row colors (optional, very subtle)
- Status badges inline
- Action buttons on row hover

---

## Sidebar Navigation Style

### Modern Pattern
```
[Logo]  RevolRMO
------------------------
[Search input...        ]

MAIN
  [icon] Dashboard
  [icon] Payments        [badge]
  [icon] Invoices
  [icon] Planning
  [icon] Projects

ADMIN
  [icon] Users
  [icon] Settings

------------------------
[Avatar] User Name
         Role
```

### Item States
- **Default**: bg-transparent, text-foreground/70
- **Hover**: bg-muted/50, text-foreground
- **Active**: bg-accent, text-accent-foreground, font-medium

---

## Dashboard Layout

### Header Section
- Welcome message with user name
- Current period (month/year)
- Optional quick actions aligned right

### KPI Grid (Top)
- 3-4 large metric cards
- Primary metric largest/most prominent
- Trend indicators with color coding

### Charts Section (Middle)
- Income tracker (line/area chart)
- Regional breakdown (bar chart)
- Payment distribution (donut chart)

### Activity Section (Bottom)
- Recent payments table
- Compact row styling
- Linked to detailed views

---

## Color Usage

### Text Colors
- **Default**: text-foreground (primary content)
- **Secondary**: text-muted-foreground (labels, meta)
- **Accent**: text-primary (links, emphasis)

### Status Colors
- **Success/Received**: text-green-600 dark:text-green-500
- **Pending**: text-amber-600 dark:text-amber-500
- **Overdue/Error**: text-red-600 dark:text-red-500
- **Info/Invoiced**: text-blue-600 dark:text-blue-400

### Background Colors
- **Page**: bg-background
- **Cards**: bg-card with subtle border
- **Sidebar**: bg-sidebar (slightly different from page)
- **Accent areas**: bg-accent or bg-muted

---

## Spacing Guidelines

- **Section padding**: p-6
- **Card internal padding**: p-6
- **Gap between cards**: gap-6
- **Gap within cards**: gap-4
- **List item padding**: py-2 px-3
- **Button padding**: Use size variants, not manual padding

---

## Micro-Interactions

- **Hover**: Subtle background shift only (use hover-elevate utility)
- **Active/Press**: Slightly more prominent (use active-elevate-2)
- **Transitions**: 150ms for hover states
- **Loading**: Skeleton loaders match component dimensions

---

## Responsive Behavior

- **Desktop (1024+)**: Full sidebar, 3-4 column grids
- **Tablet (768-1023)**: Collapsible sidebar, 2 column grids
- **Mobile (<768)**: Hidden sidebar (hamburger), single column

---

## Critical Implementation Notes

1. Never use emojis - use Lucide icons instead
2. Use semantic color tokens from index.css, not raw colors
3. Apply TekRevol orange (#F05A28) sparingly - logos, primary buttons, key accents
4. Avoid heavy shadows - prefer subtle borders or very soft elevation
5. Keep navigation items clean - icon + text + optional badge
6. User section always at sidebar bottom with avatar
