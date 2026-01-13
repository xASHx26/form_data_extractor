# React Select Extraction Guide

## Issue: React Select Options Not Extracted

React Select components (like those on DemoQA) **don't render their options in the DOM** until the dropdown is opened. This is why you see empty `options: []` arrays.

## Solution Options

### Option 1: Manual Pre-Extraction (Recommended)
**Before clicking "Extract Forms":**
1. Manually click each dropdown on the page
2. Let the options load (they'll appear in the menu)
3. Leave the dropdowns open or just interacted with
4. Then click "Extract Forms"
5. The extension will capture the visible options

### Option 2: Enhanced Auto-Extraction (In Development)
The extension now attempts to:
- Click each React Select component
- Wait for options menu to appear
- Capture the options
- Move to next dropdown

**Limitations:**
- Dependent dropdowns (State → City) won't work automatically
- Some dropdowns need parent selections first
- May require multiple extraction attempts

### Option 3: Inspect Source Code
For React Select, you can:
1. View page source code
2. Look for option data in JavaScript
3. Check network requests for API data
4. Manually document options

## Example: DemoQA Form

The DemoQA form has two React Select dropdowns:
- **State** (`react-select-3-input`) - Must be selected first
- **City** (`react-select-4-input`) - Depends on State selection

**To extract both:**
1. Visit https://demoqa.com/automation-practice-form
2. Click **State** dropdown → Select any state (e.g., "NCR")
3. Click **City** dropdown → See available cities
4. Keep page as-is
5. Open extension → Extract Forms
6. City options should now appear

## Why This Happens

React Select uses a **virtual menu** pattern:
```html
<!-- Hidden until clicked -->
<div class="react-select__menu" style="display:none">
  <div role="option">Option 1</div>
  <div role="option">Option 2</div>
</div>
```

The menu only renders when:
- User clicks the control
- Component receives focus
- JavaScript explicitly opens it

Our extension **cannot automatically interact with all dropdowns** because:
- ❌ Dependent dropdowns need prerequisites
- ❌ Some dropdowns trigger API calls
- ❌ Too many interactions can trigger page errors
- ❌ Can't determine correct sequence

## Workaround for Automation

If you need dropdown options for Selenium automation:

### Method 1: Manual Documentation
Document options manually and add to your test data:
```python
STATE_OPTIONS = ['NCR', 'Uttar Pradesh', 'Haryana', 'Rajasthan']
CITY_OPTIONS = {
    'NCR': ['Delhi', 'Gurgaon', 'Noida'],
    'Uttar Pradesh': ['Agra', 'Lucknow', 'Merrut'],
    # ...
}
```

### Method 2: Extract at Runtime
Use Selenium to get options dynamically:
```python
# Click dropdown
driver.find_element(By.ID, 'react-select-3-input').click()

# Wait for menu
wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.react-select__menu')))

# Get all options
options = driver.find_elements(By.CSS_SELECTOR, '.react-select__option')
for option in options:
    print(option.text)
```

### Method 3: API Inspection
Check Network tab for dropdown data:
1. Open DevTools → Network
2. Click dropdown
3. Look for XHR/Fetch requests
4. Find JSON response with options
5. Use that endpoint in your tests

## Current Status

✅ **Working:**
- Standard `<select>` dropdowns
- Radio buttons
- Checkboxes
- All static form elements

⚠️ **Partial:**
- React Select (requires manual interaction)
- Custom dropdowns (hit-or-miss)

❌ **Not Working:**
- Dependent React Selects (automatic)
- Lazy-loaded dropdowns
- API-driven options

## Recommendation

For the DemoQA form specifically:
1. Manually interact with State dropdown
2. Select a state
3. Click City dropdown to load its options
4. Run extraction
5. Export to CSV/JSON

The extracted data will include:
- All other fields ✅
- State dropdown options ✅ (if opened)
- City dropdown options ✅ (if parent selected)

---

**Bottom Line:** React Select is designed to be dynamic and lazy-loaded. Static extraction tools can't fully capture this without page interaction. The extension does its best, but manual intervention is sometimes required.
