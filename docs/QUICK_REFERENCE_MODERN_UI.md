# MMS Modern UI/UX - Quick Reference Guide
## For Developers & Designers

---

## 🎯 Quick Links

| File | Purpose |
|------|---------|
| `enterprise-design-system.css` | Core design tokens, variables, global styles |
| `portal-layouts.css` | App layout, sidebar, header, navigation |
| `dashboard-components.css` | Stat cards, charts, tables, activity feeds |
| `forms-and-modals.css` | Forms, inputs, modals, validation |
| `PORTAL_TEMPLATE_MODERN.html` | Complete modern portal template |
| `MODERN_UI_IMPLEMENTATION_GUIDE.md` | Full implementation documentation |

---

## 🎨 CSS Variables Cheat Sheet

### Colors
```css
--primary: #4f46e5              /* Main brand color */
--success: #10b981              /* Success/positive states */
--warning: #f59e0b              /* Warning/caution states */
--danger: #ef4444               /* Error/destructive states */
--info: #0ea5e9                 /* Information states */
--slate-900: #0f172a            /* Dark text */
--slate-500: #64748b            /* Medium gray text */
--gray-border: #e2e8f0          /* Borders */
```

### Sizes
```css
--sidebar-width: 280px          /* Desktop sidebar */
--header-height: 72px           /* Desktop header */
--radius-lg: 12px               /* Standard border radius */
--space-4: 16px                 /* Standard padding/margin */
```

### Effects
```css
--shadow-md: 0 4px 6px rgba(...) /* Standard shadow */
--transition-base: all 200ms    /* Standard animation */
```

---

## 🧩 Common Component Patterns

### Stat Card
```html
<div class="stat-card">
  <div class="stat-card-header">
    <div class="stat-icon">📊</div>
    <span class="stat-badge up"><i data-lucide="trending-up"></i> 12%</span>
  </div>
  <div class="stat-content">
    <span class="stat-label">METRIC NAME</span>
    <span class="stat-value">1,234</span>
    <span class="stat-change up"><i data-lucide="arrow-up"></i> 5% increase</span>
  </div>
</div>
```

### Data Table
```html
<div class="table-card">
  <div class="table-header">
    <h3 class="table-title">Table Title</h3>
    <div class="table-search">
      <i data-lucide="search"></i>
      <input type="text" placeholder="Search...">
    </div>
  </div>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr><th>Column 1</th><th>Column 2</th></tr>
      </thead>
      <tbody>
        <tr><td>Data</td><td>Data</td></tr>
      </tbody>
    </table>
  </div>
</div>
```

### Modal
```html
<div class="modal-overlay active">
  <div class="modal">
    <div class="modal-header">
      <h2 class="modal-title">Modal Title</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">Content here</div>
    <div class="modal-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </div>
</div>
```

### Form Group
```html
<div class="form-group">
  <label class="form-label required">Field Name</label>
  <input class="form-input" type="text" placeholder="...">
  <span class="form-help">Helper text</span>
</div>
```

### Alert
```html
<div class="alert alert-success">
  <div class="alert-icon"><i data-lucide="check-circle"></i></div>
  <div class="alert-content">
    <div class="alert-title">Success</div>
    <div class="alert-description">Message here</div>
  </div>
</div>
```

---

## 🎮 JavaScript Hooks

### Sidebar Toggle (Mobile)
```javascript
const sidebar = document.getElementById('app-sidebar');
document.getElementById('sidebar-toggle').addEventListener('click', () => {
  sidebar.classList.toggle('open');
});
```

### Navigation Item Active
```javascript
document.querySelectorAll('.nav-item').forEach(link => {
  link.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    link.classList.add('active');
  });
});
```

### Modal Control
```javascript
// Open
document.getElementById('modal').classList.add('active');

// Close
document.getElementById('modal').classList.remove('active');
```

### Toast Notification
```javascript
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${type}`;
  toastEl.textContent = message;
  container.appendChild(toastEl);
  
  setTimeout(() => toastEl.remove(), 4000);
}

toast('Operation successful!', 'success');
```

---

## 📐 Responsive Patterns

### Mobile Menu
```css
@media (max-width: 1024px) {
  .app-sidebar {
    position: fixed;
    left: -100%;
    transition: left 0.3s ease;
  }
  
  .app-sidebar.open {
    left: 0;
  }
}
```

### Grid Responsiveness
```css
.dashboard-grid-4 { grid-template-columns: repeat(4, 1fr); }
@media (max-width: 1024px) { .dashboard-grid-4 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .dashboard-grid-4 { grid-template-columns: 1fr; } }
```

---

## 🎯 Best Practices

### 1. Use CSS Variables
```css
/* Good */
color: var(--primary);
padding: var(--space-4);

/* Avoid */
color: #4f46e5;
padding: 16px;
```

### 2. Semantic HTML
```html
<!-- Good -->
<button class="btn btn-primary">Save</button>

<!-- Avoid -->
<div class="button" onclick="save()">Save</div>
```

### 3. Accessibility
```html
<!-- Good -->
<label for="email">Email</label>
<input id="email" type="email" required>

<!-- Avoid -->
<input type="email">
```

### 4. Mobile First
Write mobile styles first, then add desktop enhancements:
```css
.component { /* Mobile styles */ }
@media (min-width: 768px) { .component { /* Desktop */ } }
```

### 5. Animations
Keep animations fast and meaningful:
```css
/* Good: 200-300ms for UI feedback */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* Avoid: Too slow or too many effects */
transition: all 2s ease;
```

---

## 🔍 Debugging Tips

### Check Z-Index Stacking
```javascript
// Find all elements with z-index
document.querySelectorAll('*').forEach(el => {
  const z = window.getComputedStyle(el).zIndex;
  if (z !== 'auto') console.log(el, z);
});
```

### Verify Color Contrast
Use browser DevTools > Accessibility tab to check WCAG compliance.

### Test Responsive Breakpoints
Use DevTools to test exact breakpoints:
- Desktop: 1025px+
- Tablet: 768px - 1024px
- Mobile: Below 768px

### Performance Check
Use Chrome DevTools > Performance to profile animations and interactions.

---

## 🚀 Common Tasks

### Add New Stat Card
```html
<div class="stat-card danger">
  <div class="stat-icon">⚠️</div>
  <span class="stat-label">PENDING REVIEWS</span>
  <span class="stat-value">5</span>
</div>
```

### Change Portal Theme Color
Replace in `app-layout` class:
```html
<!-- Teacher: Emerald -->
<div class="app-layout teacher-portal">

<!-- Admin: Amber -->
<div class="app-layout admin-portal">

<!-- System: Violet -->
<div class="app-layout system-portal">
```

### Add New Navigation Item
```html
<a href="#new-section" class="nav-item">
  <i data-lucide="icon-name"></i>
  <span class="nav-item-text">Label</span>
</a>
```

### Create New Section
```html
<section id="new-section" style="display: none;">
  <div class="page-header">
    <h1>Section Title</h1>
  </div>
  <!-- Content -->
</section>
```

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Icons not showing | Run `lucide.createIcons()` after HTML loads |
| Modal appears but can't interact | Check z-index, ensure `modal-overlay.active` |
| Sidebar covers content | Check `position: fixed` not interrupting layout |
| Forms look wrong on mobile | Check 16px font-size to prevent zoom |
| Colors not applying | Verify CSS is loaded, check specificity |
| Animations stuttering | Reduce number of animating elements |

---

## 📝 Code Snippets

### Custom Toast
```javascript
function toast(message, type = 'info', duration = 4000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  
  setTimeout(() => {
    el.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}
```

### Form Validation
```javascript
function validateForm(form) {
  const inputs = form.querySelectorAll('.form-input');
  let isValid = true;
  
  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.classList.add('is-invalid');
      isValid = false;
    } else {
      input.classList.remove('is-invalid');
    }
  });
  
  return isValid;
}
```

### Dark Mode Toggle
```javascript
function toggleDarkMode() {
  document.documentElement.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.documentElement.classList.contains('dark-mode'));
}

// On load
if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark-mode');
}
```

---

## 📞 Getting Help

1. Check `MODERN_UI_IMPLEMENTATION_GUIDE.md` for full documentation
2. Review `PORTAL_TEMPLATE_MODERN.html` for working examples
3. Check CSS comments for specific component details
4. Use browser DevTools for real-time debugging
5. Test on actual devices, not just browser viewport

---

## 📅 Version History

- **v2.0** (May 6, 2026): Complete redesign with modern design system
- **v1.0** (Previous): Legacy design system

---

**Last Updated**: May 6, 2026  
**Status**: Production Ready ✅
