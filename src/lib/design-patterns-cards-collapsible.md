# Design Patterns: Cards & Collapsible Sections

## VOC Dashboard UI Consistency Guidelines

### 1. CARD CONTAINER (Standard)
```tsx
<div className="p-4 bg-card border border-border rounded-xl">
  {/* content */}
</div>
```

### 2. TOGGLE CARD (Switch + Label)
```tsx
<div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
  <Switch checked={value} onCheckedChange={onChange} />
  <div className="flex-1">
    <div className="font-medium text-sm text-button-hover">
      {/* Title with optional icon */}
      <Icon className="h-4 w-4 mr-2" />
      Toggle Label Text
    </div>
    <p className="text-xs text-muted-foreground">
      Helper description text
    </p>
  </div>
</div>
```

### 3. COLLAPSIBLE SECTION (Numbered)
```tsx
<Collapsible>
  <CollapsibleTrigger className="w-full p-4 bg-card border border-border rounded-xl flex items-center justify-between mb-4 hover:bg-card/80 transition-colors group">
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-button-hover" />
      <div className="text-left">
        <div className="text-sm font-semibold text-foreground">
          {sectionNumber}. Section Title
        </div>
        <div className="text-xs text-muted-foreground">
          Section subtitle/description
        </div>
      </div>
    </div>
    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
  <CollapsibleContent className="space-y-4 mb-6">
    {/* Section content */}
  </CollapsibleContent>
</Collapsible>
```

### 4. SECTION NUMBERING CONVENTION

#### Fixed Mode:
1. Mode Fixed
2. Waktu Distribusi Hadiah
3. Syarat Khusus

#### Dinamis Mode (without subcategories):
- Toggle Sub Kategori (no number - control toggle)
1. Dasar Perhitungan Bonus
2. Permainan & Provider
3. Hadiah dan Waktu
4. Syarat Khusus
5. Tampilkan Kontak Official

#### Tier Mode:
- Unit Poin Reward (no number)
- Rumus Perhitungan LP/EXP (no number)
- Tabel Tier Reward (no number)
- etc.

### 5. COLOR TOKENS
- **Card background**: `bg-card`
- **Card border**: `border border-border`
- **Card rounded**: `rounded-xl`
- **Title text**: `text-foreground font-semibold text-sm`
- **Subtitle text**: `text-muted-foreground text-xs`
- **Icon accent**: `text-button-hover`
- **Toggle label**: `text-button-hover font-medium text-sm`

### 6. SPACING
- Card padding: `p-4`
- Gap between icon and text: `gap-3`
- Gap between switch and content: `gap-4`
- Content spacing: `space-y-4`
- Section margin bottom: `mb-4` or `mb-6`

### 7. BADGE STYLING (Multi-select)
```tsx
{/* Selected item badge */}
<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-button-hover/20 rounded-full text-sm text-button-hover border border-button-hover/40">
  {label}
  <button className="hover:text-destructive transition-colors">
    <X className="h-3.5 w-3.5" />
  </button>
</span>

{/* Blacklist badge (destructive) */}
<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/20 rounded-full text-sm text-destructive border border-destructive/40">
  {label}
  <button className="hover:text-destructive transition-colors">
    <X className="h-3.5 w-3.5" />
  </button>
</span>
```

### 8. WARNING/INFO BOXES
```tsx
{/* Warning box */}
<div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
  <p className="text-xs text-warning">
    ⚠️ Warning message text
  </p>
</div>

{/* Amber/info box */}
<div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
  <p className="text-xs text-amber-500 font-medium">
    ⚠️ Info message text
  </p>
</div>
```

### 9. HELPER TEXT
```tsx
<p className="text-xs text-muted-foreground">
  💡 Helper tip text with emoji
</p>
```
