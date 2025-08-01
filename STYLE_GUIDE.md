# Style Guide - Siplit App

## Overview
This document outlines the design system and style guidelines for the Siplit application. All pages and components should follow these guidelines to maintain consistency across the app.

## Theme System
The app uses a dynamic theme system accessed via `useTheme()` hook from `@/contexts/ThemeContext`:

```typescript
const { currentTheme, themeMode } = useTheme();
const colors = currentTheme.colors[themeMode];
```

## Color System

### Background Colors
- **Main background**: `colors.bg.main` - Primary page background
- **Card background**: `colors.bg.card` - For cards and containers
- **Hover state**: `colors.bg.hover` - Interactive element hover states
- **Input background**: `colors.bg.input` - Form inputs
- **Darker background**: `colors.bg.darker` - Nested or secondary containers

### Text Colors
- **Primary text**: `colors.text.primary` - Main content
- **Secondary text**: `colors.text.secondary` - Subtitles and labels
- **Muted text**: `colors.text.muted` - Disabled or less important content
- **Error text**: `colors.text.error` - Error messages
- **Success text**: `colors.text.success` - Success messages

### Border Colors
- **Primary border**: `colors.border.primary` - Main borders
- **Secondary border**: `colors.border.secondary` - Subtle dividers
- **Success border**: `colors.border.success` - Success states
- **Error border**: `colors.border.error` - Error states

### Button Colors
- **Primary button**: `colors.button.primary` / `colors.button.primaryText` / `colors.button.primaryHover`
- **Success button**: `colors.button.success` / `colors.button.successText` / `colors.button.successHover`
- **Danger button**: `colors.text.error` with white text

## Component Patterns

### Cards
```jsx
<div 
  className="rounded-lg p-6" 
  style={{ 
    backgroundColor: colors.bg.card, 
    borderColor: colors.border.primary, 
    borderWidth: '1px', 
    borderStyle: 'solid' 
  }}
>
  {/* Card content */}
</div>
```

### Buttons
```jsx
<button
  className="px-4 py-2 rounded-lg transition-colors duration-200"
  style={{ 
    backgroundColor: colors.button.primary, 
    color: colors.button.primaryText 
  }}
  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.primaryHover}
  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.primary}
>
  Button Text
</button>
```

### Form Inputs
```jsx
<input
  type="text"
  className="w-full p-3 rounded-lg focus:outline-none focus:ring-2"
  style={{ 
    backgroundColor: colors.bg.input, 
    borderColor: colors.border.primary, 
    color: colors.text.primary, 
    borderWidth: '1px', 
    borderStyle: 'solid' 
  }}
/>
```

### Modals
```jsx
<div className="fixed inset-0 flex items-center justify-center z-50" 
  style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
  <div className="p-6 rounded-lg w-full max-w-md" 
    style={{ 
      backgroundColor: colors.bg.card, 
      borderColor: colors.border.primary, 
      borderWidth: '1px', 
      borderStyle: 'solid' 
    }}>
    {/* Modal content */}
  </div>
</div>
```

## Layout Guidelines

### Page Headers

#### Compact Header (Landing Pages)
Used for landing pages like /cameriere:
```jsx
<div className="mb-6">
  <h1 className="text-3xl font-bold mb-2" style={{ color: colors.text.primary }}>
    Area Title
  </h1>
  <p style={{ color: colors.text.muted }}>
    Page description
  </p>
</div>
```

#### Navigation Header (List Pages)
Used for list pages like /cameriere/nuova-ordinazione:
```jsx
<div className="mb-6">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Link href="/back-url" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
        <ArrowLeft className="h-5 w-5 text-white/70" />
      </Link>
      <h1 className="text-xl font-bold text-foreground">Page Title</h1>
    </div>
    {/* Optional right side actions */}
  </div>
</div>
```

#### Full Width Header (Detail Pages)
Used for detail pages with real-time info:
```jsx
<div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary }}>
  <div className="flex items-center gap-4">
    {/* Back Arrow */}
    <Link 
      href="/back-url" 
      className="p-1.5 rounded-lg transition-colors"
      style={{ backgroundColor: 'transparent' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = colors.bg.hover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
    >
      <ArrowLeft className="h-5 w-5" style={{ color: colors.text.secondary }} />
    </Link>
    
    {/* Title */}
    <h1 className="text-lg font-medium" style={{ color: colors.text.primary }}>
      Page Title
    </h1>
    
    {/* Time */}
    <span className="text-base" style={{ color: colors.text.secondary }}>
      {new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
    </span>
    
    {/* Separator */}
    <div className="h-5 w-px" style={{ backgroundColor: colors.border.secondary }} />
    
    {/* Additional Info */}
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color: colors.text.secondary }} />
      <span className="text-base" style={{ color: colors.text.primary }}>
        Additional info
      </span>
    </div>
    
    {/* Spacer */}
    <div className="flex-1" />
    
    {/* Right side actions */}
  </div>
</div>
```

### Page Structure
```jsx
<div className="min-h-screen pb-96" style={{ backgroundColor: colors.bg.main }}>
  {/* Header */}
  {/* Main content */}
</div>
```

### Responsive Grids
- Mobile-first approach
- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Common patterns:
  - `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
  - `grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3`

## Interactive Elements

### Hover Effects
- Scale on hover: `hover:scale-105`
- Opacity on hover: `hover:opacity-80`
- Always include `transition-all duration-200`

### Drag & Drop
```jsx
<div
  draggable
  onDragStart={(e) => handleDragStart(e)}
  onDragEnd={handleDragEnd}
  className="cursor-move"
  style={{ /* styles */ }}
>
  {/* Draggable content */}
</div>
```

### Drop Zones
- Highlight with thicker border (2px) and different background color
- Add visual feedback animations
- Show drop indicator text

## Typography

### Font Sizes
- Headers: `text-3xl` (h1), `text-xl` (h2), `text-lg` (h3)
- Body text: default size
- Small text: `text-sm`
- Extra small: `text-xs`

### Font Weights
- Bold headers: `font-bold`
- Section titles: `font-semibold`
- Normal text: `font-medium` or default

## Spacing

### Padding
- Page padding: `p-6`
- Card padding: `p-6` (large), `p-4` (medium), `p-3` (small)
- Button padding: `px-4 py-2` (normal), `px-3 py-2` (compact)

### Margins
- Section spacing: `mb-8`
- Element spacing: `mb-4`
- Inline spacing: `gap-2`, `gap-3`, `gap-4`

## Icons
- Use Lucide React icons
- Standard icon sizes: `h-6 w-6` (large), `h-5 w-5` (medium), `h-4 w-4` (small)
- Always include appropriate aria-labels for accessibility

## Animation Guidelines
- Transitions: `transition-all duration-200`
- Scale animations: `hover:scale-105` (subtle), `hover:scale-110` (prominent)
- Use CSS animations for continuous effects:

```css
@keyframes move-bg {
  0% { background-position: 0 0; }
  100% { background-position: 20px 20px; }
}
```

### Vibration Animation
For subtle feedback when items are added:
```css
@keyframes vibrate {
  0% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  50% { transform: translateX(2px); }
  75% { transform: translateX(-2px); }
  100% { transform: translateX(0); }
}
.vibrate {
  animation: vibrate 0.3s ease-in-out 3;
}
```

### Particle Effects
For celebratory feedback without interrupting workflow:
```tsx
import { ParticleEffect } from '@/components/ui/ParticleEffect';

// Usage with key-based triggering
const [particleKey, setParticleKey] = useState(0);
const [particlePos, setParticlePos] = useState({ x: 0, y: 0 });

// Trigger particles
const triggerParticles = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  setParticlePos({ x: rect.right - 40, y: rect.top - 20 });
  setParticleKey(prev => prev + 1);
};

// Render
<ParticleEffect 
  key={particleKey}
  trigger={true} 
  x={particlePos.x} 
  y={particlePos.y}
  particleCount={20}
  duration={3000}
/>
```

## Best Practices

1. **Always use the theme system** - Never hardcode colors
2. **Maintain consistency** - Use the same patterns across all pages
3. **Mobile-first design** - Ensure all layouts work on mobile
4. **Accessibility** - Include proper ARIA labels and keyboard navigation
5. **Performance** - Use `transition-colors` instead of `transition-all` when only colors change
6. **User feedback** - Always provide visual feedback for interactive elements

## Reusable Components

### ThemedModal
A modal component that follows the theme system:
```jsx
import { ThemedModal } from '@/components/ui/ThemedModal';

<ThemedModal 
  isOpen={isOpen} 
  onClose={handleClose} 
  title="Modal Title"
  showCloseButton={true}
>
  {/* Modal content */}
</ThemedModal>
```

### ThemedDrawer
A bottom drawer component for mobile-friendly interactions:
```jsx
import { ThemedDrawer } from '@/components/ui/ThemedDrawer';

<ThemedDrawer
  isOpen={isOpen}
  onToggle={() => setIsOpen(!isOpen)}
  headerContent={
    <div className="flex items-center justify-between w-full">
      <span>Drawer Title</span>
      <span>€10.00</span>
    </div>
  }
>
  {/* Drawer content */}
</ThemedDrawer>
```

### Customer Name Modal with Tags
Modal with clickable tag suggestions:
```jsx
{suggestions.length > 0 && (
  <div className="mt-4">
    <p className="text-xs mb-2" style={{ color: colors.text.muted }}>
      Previous customers:
    </p>
    <div className="flex flex-wrap gap-2">
      {suggestions.slice(0, 8).map((name, index) => (
        <button
          key={index}
          type="button"
          onClick={() => setCustomerName(name)}
          className="px-3 py-1 rounded-full text-sm transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: colors.bg.hover,
            color: colors.text.primary,
            borderColor: colors.border.primary,
            borderWidth: '1px',
            borderStyle: 'solid'
          }}
        >
          {name}
        </button>
      ))}
    </div>
  </div>
)}
```

## Component Checklist
When creating new components or pages, ensure:
- [ ] Uses theme colors from `useTheme()` hook
- [ ] Responsive on all screen sizes
- [ ] Interactive elements have hover states
- [ ] Forms have proper validation and error states
- [ ] Modals have proper z-index and backdrop
- [ ] Loading states are implemented
- [ ] Error handling is in place
- [ ] Animations are smooth and purposeful
- [ ] Visual feedback uses particles/vibration instead of toast notifications
- [ ] Modals prevent accidental closure when data is required