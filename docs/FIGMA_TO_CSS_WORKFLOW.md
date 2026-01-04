# Figma to CSS Workflow Guide

This guide shows you how to design UI components in Figma and bring those styles into your `styles.css` file for `teamridepro.html`.

## Why Figma?

- **Design-focused:** Built specifically for UI/UX design
- **Component-based:** Perfect for designing buttons, cards, modals, etc.
- **CSS export:** Can copy CSS values directly
- **Free tier:** Sufficient for most projects
- **Industry standard:** Used by most design teams

## Step 1: Design in Figma

### Creating Your Design

1. **Open Figma** (desktop app or browser at [figma.com](https://figma.com))
2. **Create a new file** or open an existing design file
3. **Design your component:**
   - Create frames for different UI elements (buttons, cards, headers, etc.)
   - Use Figma's design tools to style them:
     - Colors, fonts, spacing, borders, shadows
     - Layout (flexbox, grid)
     - Responsive breakpoints

### Example: Designing a Button

1. Create a rectangle frame
2. Set background color: `#2196F3`
3. Add text: "Click Me"
4. Set padding: `10px 20px`
5. Add border radius: `4px`
6. Set font: `14px, bold`

## Step 2: Extract CSS from Figma

### Method 1: Copy CSS Properties (Recommended)

1. **Select an element** in Figma (e.g., your button)
2. **Open the "Code" panel** (right sidebar, or press `Cmd/Ctrl + Shift + E`)
3. **Choose "CSS"** from the dropdown
4. **Copy the CSS** — Figma will show you something like:
   ```css
   background: #2196F3;
   border-radius: 4px;
   padding: 10px 20px;
   font-size: 14px;
   font-weight: bold;
   ```
5. **Paste into `styles.css`** in Cursor

### Method 2: Inspect Element Properties

1. **Select an element** in Figma
2. **Check the right sidebar** for all properties:
   - Fill (background color)
   - Stroke (border)
   - Effects (shadows, blurs)
   - Typography (font, size, weight)
   - Layout (padding, margin, gap)
3. **Manually write CSS** based on these values

### Method 3: Use Figma Plugins

1. **Install a CSS export plugin** (e.g., "CSS Gen", "Figma to CSS")
2. **Select your element**
3. **Run the plugin** to generate CSS
4. **Copy the output** to `styles.css`

## Step 3: Apply CSS to Your Project

### Option A: Direct Edit in Cursor

1. Open `styles.css` in Cursor
2. Find the relevant CSS class (e.g., `.btn-small`)
3. Update the properties with values from Figma:
   ```css
   .btn-small {
       background: #2196F3;        /* From Figma Fill */
       border-radius: 4px;          /* From Figma Corner Radius */
       padding: 10px 20px;          /* From Figma Padding */
       font-size: 14px;             /* From Figma Typography */
       font-weight: bold;            /* From Figma Typography */
   }
   ```
4. Save the file
5. Refresh your browser to see changes

### Option B: Use DevTools Local Overrides

1. Open `teamridepro.html` in Chrome
2. Enable **Local Overrides** (see `DEVTOOLS_LOCAL_OVERRIDES.md`)
3. Select the element you want to style
4. Paste/type the CSS from Figma directly in DevTools
5. Changes auto-save to `styles.css`

## Step 4: Map Figma Properties to CSS

### Common Mappings

| Figma Property | CSS Property | Example |
|---------------|-------------|---------|
| Fill | `background` or `background-color` | `#2196F3` |
| Stroke | `border` | `1px solid #ddd` |
| Corner Radius | `border-radius` | `4px` |
| Padding | `padding` | `10px 20px` |
| Gap | `gap` | `10px` |
| Font Family | `font-family` | `'Segoe UI', sans-serif` |
| Font Size | `font-size` | `14px` |
| Font Weight | `font-weight` | `600` or `bold` |
| Letter Spacing | `letter-spacing` | `0.5px` |
| Line Height | `line-height` | `1.5` |
| Effects → Drop Shadow | `box-shadow` | `0 2px 4px rgba(0,0,0,0.1)` |
| Effects → Blur | `filter: blur()` | `blur(10px)` |
| Opacity | `opacity` | `0.8` |
| Auto Layout → Direction | `flex-direction` | `row` or `column` |
| Auto Layout → Align | `align-items` | `center`, `flex-start` |
| Auto Layout → Justify | `justify-content` | `space-between` |

### Converting Figma Values

**Colors:**
- Figma: `#2196F3` → CSS: `#2196F3` (same)
- Figma: `rgba(33, 150, 243, 0.8)` → CSS: `rgba(33, 150, 243, 0.8)` (same)

**Spacing:**
- Figma: `10px` → CSS: `10px` (same)
- Figma: `0px 10px 20px 5px` → CSS: `0 10px 20px 5px` (remove `px` from `0`)

**Shadows:**
- Figma: `X: 0, Y: 2, Blur: 4, Spread: 0, Color: rgba(0,0,0,0.1)`
- CSS: `box-shadow: 0 2px 4px 0 rgba(0,0,0,0.1);`

## Step 5: Organize Your CSS

### Best Practices

1. **Group related styles:**
   ```css
   /* Buttons */
   .btn-small { ... }
   .btn-large { ... }
   
   /* Cards */
   .rider-card { ... }
   .coach-card { ... }
   ```

2. **Use CSS variables for Figma design tokens:**
   ```css
   :root {
       --primary-color: #2196F3;      /* From Figma */
       --border-radius: 4px;          /* From Figma */
       --spacing-sm: 8px;              /* From Figma */
       --spacing-md: 16px;             /* From Figma */
   }
   
   .btn-small {
       background: var(--primary-color);
       border-radius: var(--border-radius);
       padding: var(--spacing-sm) var(--spacing-md);
   }
   ```

3. **Comment your CSS with Figma references:**
   ```css
   /* Button styles - Based on Figma "Primary Button" component */
   .btn-small {
       background: #2196F3;  /* Figma: Fill #2196F3 */
       padding: 10px 20px;   /* Figma: Auto Layout Padding */
   }
   ```

## Step 6: Test and Iterate

1. **Save `styles.css`**
2. **Refresh your browser** (or use Live Server for auto-reload)
3. **Compare** the result with your Figma design
4. **Adjust** as needed:
   - Use DevTools Local Overrides for quick tweaks
   - Or edit `styles.css` directly in Cursor

## Advanced: Responsive Design

### Figma Breakpoints

If you design multiple breakpoints in Figma:

1. **Create frames** for different screen sizes:
   - Mobile: `375px` width
   - Tablet: `768px` width
   - Desktop: `1440px` width

2. **Extract CSS for each breakpoint**

3. **Apply as media queries** in `styles.css`:
   ```css
   /* Mobile (from Figma mobile frame) */
   .btn-small {
       padding: 12px 16px;
       font-size: 16px;
   }
   
   /* Desktop (from Figma desktop frame) */
   @media (min-width: 768px) {
       .btn-small {
           padding: 10px 20px;
           font-size: 14px;
       }
   }
   ```

## Workflow Summary

1. **Design in Figma** → Create your UI components
2. **Extract CSS** → Use Code panel or inspect properties
3. **Apply to `styles.css`** → Paste/type CSS into your file
4. **Test in browser** → Refresh and compare
5. **Iterate** → Use DevTools Local Overrides for fine-tuning

## Tips

✅ **Design system:** Create a Figma file with all your design tokens (colors, spacing, typography) for consistency  
✅ **Components:** Design reusable components in Figma (buttons, cards, inputs) and export CSS for each  
✅ **Version control:** Keep your Figma file synced with your code changes  
✅ **Collaboration:** Share Figma files with team members for feedback before implementing  

## Example: Complete Button Redesign

**Figma Design:**
- Background: `#4CAF50` (green)
- Padding: `12px 24px`
- Border radius: `8px`
- Font: `16px, semibold`
- Shadow: `0 4px 8px rgba(0,0,0,0.15)`

**CSS in `styles.css`:**
```css
button {
    background: #4CAF50;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}
```

**Result:** Your button now matches your Figma design!

---

**Next Steps:**
- See `DEVTOOLS_LOCAL_OVERRIDES.md` for automatic CSS saving
- See `VISUAL_EDITING_GUIDE.md` for more visual editing options

















