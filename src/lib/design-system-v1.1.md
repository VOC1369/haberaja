# VOC Design System V1.1 Documentation

## Overview
This document defines the mandatory CSS standards, classes, and patterns for the VOC platform. All components must follow these guidelines without exception.

---

## 1. Color System (3-Layer Hierarchy)

### Layer 1: Page Background
```css
bg-background  /* #1f1f1f - Body/page background */
```

### Layer 2: Card/Section Background
```css
bg-card        /* #262626 - Main cards, sections, containers */
```

### Layer 3: Nested Content Background
```css
bg-muted       /* #353337 - Value boxes, inputs, nested content */
```

### Accent Colors
```css
text-button-hover      /* #F5BC1C - Golden accent (primary interactive) */
text-foreground        /* White - Primary text */
text-muted-foreground  /* Grey - Secondary/helper text */
text-destructive       /* Red - Error/delete actions */
text-success           /* Green - Success states */
text-warning           /* Orange - Warning states */
```

### ⚠️ BANNED Practices
- ❌ Opacity on CARDS: `bg-card/50`, `bg-card/80`
- ❌ Opacity on BORDERS: `border-border/50`
- ❌ Direct colors: `text-white`, `bg-black`, `text-gray-500`
- ❌ Non-HSL colors

### ✅ ALLOWED Opacity (Exceptions)
```css
bg-muted/30         /* Table headers ONLY */
hover:bg-muted/20   /* Table row hover ONLY */
bg-button-hover/20  /* Icon circles, action buttons */
bg-success/20       /* Status badges */
bg-destructive/20   /* Status badges, delete buttons */
bg-warning/20       /* Status badges, conflict badges */
bg-primary/20       /* Status badges */
bg-purple/20        /* Super Admin badge */
```

---

## 2. Layout Classes

### Page Wrapper (Standardized Width)
```css
.page-wrapper {
  @apply max-w-7xl mx-auto;  /* 1280px max-width, centered */
}
```
**Usage:** All knowledge base sections, form pages, list views

### Content Spacing
```css
space-y-5    /* Standard vertical spacing between sections */
space-y-6    /* Alternative vertical spacing */
space-y-10   /* Large section separation */
gap-6        /* Standard grid/flex gap (NOT gap-4) */
```

### Footer Gap (Fixed)
```css
pb-[90px]    /* Content-to-footer padding (LOCKED) */
```

---

## 3. Card Patterns

### Type A: Form Card
```css
.form-card {
  @apply bg-card border border-border rounded-xl p-8;
}

.form-card-header {
  @apply mb-8 flex items-center gap-4;
}

.form-card-title {
  @apply text-lg font-semibold text-button-hover;
}

.form-card-description {
  @apply text-sm text-muted-foreground;
}

.form-section {
  @apply space-y-8;
}
```

### Type B: Value Box (Read-only Display)
```css
/* Standard Value Box */
bg-background border border-border rounded-lg min-h-10 px-4 py-2

/* NO border-l-2, NO custom accent colors */
```

### Type C: Table Container
```css
/* Container */
border border-border rounded-lg overflow-hidden

/* Header Row */
bg-muted/30 hover:bg-muted/30

/* Header Cells */
text-foreground font-semibold

/* Body Rows */
hover:bg-muted/20

/* Row Divider */
border-t border-border
```

---

## 4. Icon Circle Pattern

```css
.icon-circle {
  @apply h-12 w-12 rounded-full bg-button-hover/20 flex items-center justify-center;
}

.icon-circle-icon {
  @apply h-6 w-6 text-button-hover;
}

/* Small variant */
.icon-circle-sm {
  @apply h-10 w-10 rounded-full bg-button-hover/20 flex items-center justify-center;
}
```

---

## 5. Button Variants

### Standard Variants (rounded-full)
```css
variant="default"        /* bg-primary, golden hover */
variant="destructive"    /* bg-destructive */
variant="outline"        /* border, transparent bg */
variant="secondary"      /* bg-secondary/50 */
variant="ghost"          /* transparent, hover effect */
variant="link"           /* underline on hover */
variant="golden"         /* bg-button-hover text-black */
variant="golden-outline" /* border-2 border-button-hover */
```

### Button Sizes
```css
size="default"   /* h-10 px-4 py-2 */
size="sm"        /* h-9 px-3 */
size="lg"        /* h-11 px-8 */
size="xl"        /* h-12 px-8 text-lg */
size="icon"      /* h-10 w-10 */
size="icon-sm"   /* h-8 w-8 */
```

### Action Button Styling (Tables)
```css
/* Edit Button */
h-10 w-10 hover:bg-button-hover/20 hover:text-button-hover

/* Delete Button */
h-10 w-10 hover:bg-destructive/20 hover:text-destructive
```

---

## 6. Form Elements

### Input/Select/Textarea
```css
/* Base styling */
bg-background border border-border rounded-lg

/* Focus state */
focus:ring-2 focus:ring-ring focus:ring-offset-2

/* Error state */
border-destructive
```

### Form Labels (Typography Level 2)
```css
text-sm font-medium text-foreground
```

### Helper Text (Typography Level 5)
```css
text-sm text-muted-foreground
```

---

## 7. Typography Hierarchy (5 Levels)

| Level | Usage | Class |
|-------|-------|-------|
| 1 | Section Title | `text-lg font-semibold text-button-hover` |
| 2 | Field Label | `text-sm font-medium text-foreground` |
| 3 | Sub-Label | `text-sm font-medium text-muted-foreground` |
| 4 | Empty State | `text-sm text-muted-foreground` |
| 5 | Helper/Placeholder | `text-sm text-muted-foreground` |

### Section Title Numbering (Mandatory)
```
1. Kontak Admin
2. Pengaturan Eskalasi
3. Issue Mapping
```

---

## 8. Collapsible Components

### Trigger (Closed State)
```css
bg-card border border-border rounded-xl p-6
```

### Trigger (Open State)
```css
bg-card border border-border rounded-t-xl border-b-0 p-6
```

### Content
```css
bg-card border border-border border-t-0 rounded-b-xl p-6 pt-4
```

---

## 9. Empty State Pattern

```css
/* Container */
flex flex-col items-center justify-center py-12 text-center

/* Icon Wrapper */
h-16 w-16 rounded-full bg-button-hover/20 flex items-center justify-center mb-4

/* Icon */
h-8 w-8 text-button-hover

/* Heading */
text-lg font-semibold text-foreground mb-2

/* Description */
text-muted-foreground mb-6 max-w-md

/* Action Button */
bg-button-hover text-button-hover-foreground hover:bg-button-hover/90
```

---

## 10. Status Badges

```css
/* Success */
bg-success/20 text-success

/* Error/Destructive */
bg-destructive/20 text-destructive

/* Warning */
bg-warning/20 text-warning

/* Info/Default */
bg-primary/20 text-primary

/* Purple (Super Admin) */
bg-purple/20 text-purple
```

---

## 11. Fixed Footer Navigation

```css
/* Position */
fixed bottom-0 left-0 md:left-64 right-0

/* Styling */
bg-background border-t border-border p-4 z-50

/* Button Layout */
flex items-center justify-between
```

---

## 12. Scroll Management

### Standard Scroll (Single Container)
```css
html, body {
  height: 100dvh !important;
  max-height: 100dvh !important;
  overflow: hidden !important;
}

/* APBE Main Content - Explicit scroll */
[data-scroll="apbe-main"] {
  overflow-y: auto !important;
  height: calc(100vh - 90px); /* footer height LOCKED */
  overscroll-behavior: contain;
}
```

### Full-Viewport Preview Mode (JSON/Prompt Preview)

For pages where outer layout must NOT scroll and only inner content scrolls:

#### Layer 1: Dashboard.tsx Main Wrapper
```jsx
// Conditional overflow-hidden for json/prompt mode
<main className={`... ${viewMode === "json" || viewMode === "prompt" ? "!overflow-hidden" : "overflow-y-auto"}`}>
  <div className={`... ${viewMode === "json" || viewMode === "prompt" ? "h-full overflow-hidden" : "p-6 pt-8 ..."}`}>
```

#### Layer 2: Preview Component Outer Container
```jsx
// Fixed viewport height, NO scroll
<div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden px-6 py-4">
```

#### Layer 3: Inner Code Block (ONLY THIS SCROLLS)
```jsx
// Outer card - NO scroll
<div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-xl bg-card border border-border p-6">
  // Inner code - SCROLL HERE
  <div className="flex-1 min-h-0 overflow-auto rounded-lg bg-[#1C1C1C] p-6">
    <pre>...</pre>
  </div>
</div>
```

### ✅ Key Rules for Preview Mode
- Use `h-[calc(100vh-64px)]` for fixed viewport height (64px = header)
- Apply `overflow-hidden` on ALL outer layers
- Use `flex-1 min-h-0 overflow-auto` ONLY on inner scrollable content
- Never use `h-full` without parent having fixed height
- Never use `overflow-auto` on outer wrappers

### ⚠️ Important Notes
- Single scroll container prevents multi-scroll bugs
- APBE forms require explicit scroll on `[data-scroll="apbe-main"]`
- Footer height is LOCKED at 90px — do not change

---

## 13. Validation Notifications

### Error State
```css
bg-red-500/10 border border-red-500/40 text-red-500
/* Secondary text: text-red-400 */
```

### Warning State
```css
bg-warning/10 border border-warning/40 text-warning
```

### Success State
```css
bg-success/10 border border-success/40 text-success
```

---

## 14. Conflict Badge (Cross-form Validation)

```css
/* Orange warning badge */
bg-warning/20 text-warning ring-2 ring-warning/30 rounded-full p-1
```

---

## 15. Dialog/AlertDialog

### Container (Override Shadcn Default)
```css
/* Override shadcn rounded-lg → rounded-xl */
bg-card border border-border rounded-xl
```

### Header & Description
```css
/* Header */
text-lg font-semibold text-foreground

/* Description */
text-sm text-muted-foreground
```

### Radius Inheritance Rule
- Dialog container: `rounded-xl` (MANDATORY override)
- Cards inside Dialog: follow parent → `rounded-xl`
- Inputs inside Dialog: `rounded-lg` (unchanged)

### ⚠️ NO Mixing Rule
- All direct children of Dialog content inherit `rounded-xl`
- Only form inputs/selects use `rounded-lg`

---

## 16. Tabs Component

```css
/* Tab List */
bg-muted/30 rounded-lg p-1

/* Tab Trigger (Inactive) */
text-muted-foreground

/* Tab Trigger (Active) */
bg-background text-foreground shadow-sm
```

---

## 17. Padding Standards

### Allowed
```css
p-4    /* Value boxes only */
p-6    /* Collapsible trigger/content */
p-8    /* Form cards */
px-4 py-2  /* Inputs, value boxes */
```

### ⚠️ BANNED (Custom Components)
```css
p-3    /* Never use */
p-5    /* Never use in custom components */
```

### ⚠️ ALLOWED (Shadcn Inheritance)
```css
p-5    /* ONLY if inherited from shadcn internal default (do not override) */
```

---

## 18. Border Radius Standards

```css
rounded-full   /* Buttons, badges */
rounded-xl     /* Cards, dialogs */
rounded-lg     /* Inputs, tables, value boxes */
```

### ⚠️ BANNED
- ❌ Mixing `rounded-lg` and `rounded-xl` in single card
- ❌ Using `rounded-md` or `rounded-sm` for main components

---

## 19. Font Family

```css
font-sans   /* Inter - Default for all UI */
font-serif  /* Lora - Special display text */
font-mono   /* Space Mono - Code/technical display */
```

### ⚠️ BANNED
- ❌ Using `font-mono` for rule names or regular labels

---

## 20. Responsive Breakpoints

```css
md:left-64   /* Sidebar offset on medium+ screens */
grid-cols-1 md:grid-cols-2  /* Form grid responsive */
```

---

## Quick Reference: Common Patterns

### Knowledge Base Section Header
```jsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-4">
    <div className="icon-circle">
      <Icon className="icon-circle-icon" />
    </div>
    <div>
      <h2 className="text-2xl font-bold text-button-hover">Title</h2>
      <p className="text-muted-foreground">Description</p>
    </div>
  </div>
  <div className="flex gap-2">
    {/* Action buttons */}
  </div>
</div>
```

### Table Structure
```jsx
<div className="border border-border rounded-lg overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableHead className="text-foreground font-semibold">Column</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow className="hover:bg-muted/20">
        <TableCell className="py-4">Content</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| V1.0 | 2024-12 | Initial design system |
| V1.1 | 2024-12 | Added page-wrapper, standardized patterns |
| V1.1.1 | 2024-12 | Fixed 4 conflict areas: opacity exceptions, p-5 shadcn inheritance, scroll height calc, dialog radius override |
| V1.2.1 | 2024-12 | Added Full-Viewport Preview Mode scroll pattern for JSON/Prompt pages |

---

**Note:** This design system is MANDATORY for all components. No exceptions.
