# Chrome DevTools Local Overrides Guide

**Local Overrides** is a powerful Chrome DevTools feature that automatically saves your CSS and HTML changes directly to your files. No more copy/paste! Changes you make in DevTools are automatically written to your `styles.css` file.

## Setup (One-Time)

### Step 1: Open DevTools
1. Open `teamridepro.html` in Chrome.
2. Press `F12` (or right-click → "Inspect") to open DevTools.

### Step 2: Enable Local Overrides
1. In DevTools, click the **"Sources"** tab (or press `Ctrl+Shift+P` and type "Sources").
2. In the left sidebar, find and click **"Overrides"** (under "Page").
3. Click **"Select folder for overrides"**.
4. Navigate to your project folder:
   ```
   D:\PREVISION DESIGN Dropbox\Adam Phillips\05 Personal\MTB Team\Team Practice Pro
   ```
5. Click **"Select Folder"**.
6. Chrome will ask for permission. Click **"Allow"**.

### Step 3: Enable Overrides
1. Check the box next to **"Enable Local Overrides"** at the top of the Overrides panel.
2. You should see a purple dot (●) next to "Overrides" in the sidebar, indicating it's active.

## Using Local Overrides

### Making CSS Changes

1. **Select an Element:**
   - Press `Ctrl+Shift+C` (Windows/Linux) or `Cmd+Shift+C` (Mac) to activate element selector.
   - Click on any element on the page (e.g., a button, header, card).

2. **Edit CSS:**
   - In the DevTools "Elements" tab, find the selected element in the HTML tree.
   - In the "Styles" panel (right side), you'll see all CSS rules affecting that element.
   - **To modify existing styles:** Click on any property value and edit it (e.g., change `padding: 10px` to `padding: 20px`).
   - **To add new styles:** Click in the empty space in the Styles panel and type a new property (e.g., `background-color: red;`).

3. **Changes Auto-Save:**
   - As soon as you make a change, Chrome automatically saves it to `styles.css`.
   - You'll see a notification: "Local Overrides: 1 file modified" in the Overrides panel.
   - The change is **permanent** — no copy/paste needed!

### Making HTML Changes

1. **Edit HTML:**
   - In the "Elements" tab, right-click any HTML element.
   - Select **"Edit as HTML"**.
   - Make your changes.
   - Press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac) to apply.

2. **Changes Auto-Save:**
   - HTML changes are saved to `teamridepro.html` automatically.

### Viewing Your Changes

1. **In DevTools:**
   - Click the "Overrides" tab in the Sources panel.
   - You'll see a list of all modified files (`styles.css`, `teamridepro.html`, etc.).
   - Click any file to view the changes.

2. **In Your Editor:**
   - Open `styles.css` in Cursor (or any editor).
   - Your changes are already there!

## Tips & Tricks

### 1. **Disable Overrides Temporarily**
- Uncheck "Enable Local Overrides" to see the original page.
- Re-check to see your changes again.

### 2. **Clear All Overrides**
- Right-click the "Overrides" folder in DevTools.
- Select "Clear configuration" to remove all overrides (doesn't delete your files, just stops tracking).

### 3. **Multiple Files**
- Local Overrides works for **all files** loaded by the page:
  - `styles.css` ✓
  - `teamridepro.html` ✓
  - Any JavaScript files ✓
  - Any other CSS/HTML files ✓

### 4. **Network Throttling**
- Local Overrides works even when you're offline or using network throttling.

### 5. **Undo Changes**
- In DevTools, right-click a modified file in the Overrides panel.
- Select "Revert" to undo changes (or edit the file directly in Cursor).

## Workflow Example

**Scenario:** You want to change the button color from blue to green.

1. Open `teamridepro.html` in Chrome.
2. Press `F12` → "Elements" tab.
3. Press `Ctrl+Shift+C` and click a button.
4. In the Styles panel, find `background: #2196F3;`.
5. Click on `#2196F3` and change it to `#4CAF50`.
6. **Done!** The change is automatically saved to `styles.css`.
7. Open `styles.css` in Cursor to see: `background: #4CAF50;`

No copy/paste, no manual file editing — it just works!

## Troubleshooting

**Q: Changes aren't saving?**
- Make sure "Enable Local Overrides" is checked.
- Verify you selected the correct project folder.
- Check that Chrome has write permissions to the folder.

**Q: I see a purple dot but changes don't save?**
- Try disabling and re-enabling Local Overrides.
- Make sure you're editing CSS in the "Styles" panel, not the "Computed" panel.

**Q: Can I use this with VS Code Live Server?**
- Yes! Local Overrides works with any local server (Live Server, `file://`, etc.).

**Q: What if I edit `styles.css` directly in Cursor?**
- Your manual edits will be reflected in the browser after a refresh.
- Local Overrides will continue to track changes made in DevTools.

## Benefits

✅ **No copy/paste** — Changes save automatically  
✅ **Instant feedback** — See changes immediately  
✅ **Version control friendly** — Changes are in your actual files  
✅ **Works offline** — No internet needed  
✅ **Multi-file support** — Works for CSS, HTML, and JavaScript  

This is the **fastest way** to experiment with styles and see results instantly!


















