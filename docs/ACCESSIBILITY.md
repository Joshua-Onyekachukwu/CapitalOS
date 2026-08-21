# Accessibility — Capital-OS

## Standard

**WCAG 2.1 Level AA** — All UI components must meet these requirements.

---

## Principles

### 1. Perceivable

Information and UI components must be presentable to users in ways they can perceive.

**Requirements:**
- All images have descriptive `alt` text
- All form inputs have associated `<label>` elements
- Color contrast ratio ≥ 4.5:1 for normal text
- Color contrast ratio ≥ 3:1 for large text
- Content can be zoomed to 200% without loss
- No information conveyed by color alone

### 2. Operable

UI components and navigation must be operable.

**Requirements:**
- All functionality available via keyboard
- No keyboard traps
- Skip navigation links
- Focus indicators visible on all interactive elements
- Page titles are descriptive
- Headings are hierarchical (h1 → h2 → h3)
- Links are descriptive (not "click here")

### 3. Understandable

Information and UI operation must be understandable.

**Requirements:**
- Text is readable and understandable
- Content appears and operates predictably
- Error messages are clear and specific
- Form validation provides guidance
- Language attribute set on `<html>`

### 4. Robust

Content must be robust enough for assistive technologies.

**Requirements:**
- Valid HTML semantics
- ARIA attributes where needed
- Dynamic content updates announced to screen readers
- Compatible with VoiceOver, NVDA, JAWS

---

## Implementation Checklist

### Forms

- [ ] All inputs have labels
- [ ] Required fields indicated (not just by color)
- [ ] Error messages linked to inputs via `aria-describedby`
- [ ] Form validation announced to screen readers
- [ ] Tab order is logical

```tsx
// ✅ Good
<label htmlFor="startup-name">Startup Name</label>
<input
  id="startup-name"
  name="name"
  required
  aria-describedby="name-error"
  aria-invalid={!!error}
/>
{error && <p id="name-error" role="alert">{error}</p>}

// ❌ Bad
<input placeholder="Startup Name" />
```

### Navigation

- [ ] Skip to main content link
- [ ] Landmark regions (`<nav>`, `<main>`, `<aside>`)
- [ ] Keyboard accessible sidebar
- [ ] Focus management on route changes

```tsx
// Skip link
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

// Landmark
<main id="main-content" role="main">
  {children}
</main>
```

### Tables

- [ ] Proper `<table>`, `<thead>`, `<tbody>` structure
- [ ] `<th>` elements for headers
- [ ] `scope` attribute on headers
- [ ] `caption` or `aria-label` for table purpose

```tsx
<table>
  <caption>Investor Pipeline</caption>
  <thead>
    <tr>
      <th scope="col">Investor</th>
      <th scope="col">Fit Score</th>
      <th scope="col">Stage</th>
    </tr>
  </thead>
  <tbody>...</tbody>
</table>
```

### Modals / Dialogs

- [ ] Focus trapped within modal
- [ ] Close button keyboard accessible
- [ ] Escape key closes modal
- [ ] Focus returns to trigger element on close
- [ ] `aria-modal="true"` and `role="dialog"`

### Kanban Board

- [ ] Cards keyboard navigable
- [ ] Drag-and-drop has keyboard alternative
- [ ] Live region announces card movement
- [ ] Column headings accessible

```tsx
// Live region for dynamic updates
<div aria-live="polite" aria-atomic="true">
  {`${card.name} moved to ${newColumn.name}`}
</div>
```

### Loading States

- [ ] `aria-busy="true"` during loading
- [ ] `role="status"` for loading indicators
- [ ] Screen reader announcement of loading state

```tsx
<div role="status" aria-busy={isLoading}>
  {isLoading ? (
    <span className="sr-only">Loading investors...</span>
  ) : (
    <InvestorList investors={investors} />
  )}
</div>
```

### Empty States

- [ ] Descriptive heading
- [ ] Clear call to action
- [ ] Keyboard accessible action button

### Error States

- [ ] `role="alert"` for error messages
- [ ] Clear description of what went wrong
- [ ] Actionable recovery option
- [ ] Focus moved to error message

```tsx
<div role="alert" className="error-container">
  <h3>Unable to load investors</h3>
  <p>Please check your connection and try again.</p>
  <button onClick={retry}>Retry</button>
</div>
```

### Color & Contrast

- [ ] Primary text: ≥ 4.5:1 contrast ratio
- [ ] Large text (18px+): ≥ 3:1 contrast ratio
- [ ] Interactive elements: ≥ 3:1 contrast ratio
- [ ] Focus indicators: ≥ 3:1 contrast ratio
- [ ] Error states not conveyed by color alone

### Images & Icons

- [ ] All `<img>` have `alt` text
- [ ] Decorative images use `alt=""`
- [ ] Icons have accessible labels
- [ ] SVGs have `aria-label` or `<title>`

```tsx
// Informational image
<img src="/logo.png" alt="Capital-OS logo" />

// Decorative image
<img src="/decorative-bg.svg" alt="" aria-hidden="true" />

// Icon button
<button aria-label="Delete investor">
  <TrashIcon />
</button>
```

---

## Trezo Template Audit

Before using Trezo components, verify:

- [ ] All Trezo components meet WCAG 2.1 AA
- [ ] Color palette has sufficient contrast
- [ ] Keyboard navigation works throughout
- [ ] Screen reader compatible
- [ ] Fix any issues before integration

---

## Testing Tools

### Automated

- **axe DevTools** — Browser extension for accessibility testing
- **Lighthouse** — Chrome DevTools accessibility audit
- **eslint-plugin-jsx-a11y** — ESLint rules for accessibility

### Manual

- **Keyboard navigation** — Tab through entire app
- **Screen reader testing** — VoiceOver (Mac), NVDA (Windows)
- **Zoom testing** — 200% zoom, no content loss
- **Color contrast** — Use WebAIM contrast checker

### Testing Commands

```bash
# Lighthouse audit
npx lighthouse http://localhost:3000 --only-categories=accessibility

# ESLint a11y rules (already in eslint config)
pnpm lint
```

---

## Common Patterns

### Screen Reader Only Text

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Focus Visible

```css
/* Global focus styles */
*:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apd/)
- [Inclusive Components](https://inclusive-components.design/)
