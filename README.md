# Form Extractor for Selenium

A powerful Chrome extension that extracts comprehensive form data from any webpage for Selenium automation testing.

## Features

✅ **Complete Element Extraction**
- Extracts all form elements (input, select, textarea, button)
- Captures IDs, names, classes, types, values, placeholders
- Identifies associated labels and ARIA attributes
- Generates optimized and full XPath selectors
- Provides CSS selectors as alternatives
- **⚛️ Extracts React Testing Library selectors** (data-testid, role-based queries)

✅ **Dropdown Analysis**
- Extracts all select options with values and text
- Captures option states (selected, disabled)
- Groups radio/checkbox options

✅ **Dependency Detection**
- Identifies which fields control other fields
- Detects enable/disable relationships
- Finds conditional visibility patterns
- Maps field dependencies automatically

✅ **Modern UI**
- Organized tabbed interface
- Search and filter capabilities
- One-click XPath copying
- **JSON and CSV export** functionality
- Beautiful, responsive design

## Installation

### Load as Unpacked Extension (Development)

1. **Clone or download this repository**
   ```
   git clone <repository-url>
   cd form-extractor
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Or click: Menu → Extensions → Manage Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `form` folder containing `manifest.json`

5. **Pin the extension**
   - Click the puzzle icon in the Chrome toolbar
   - Find "Form Extractor for Selenium"
   - Click the pin icon to keep it visible

## Usage

### Basic Extraction

1. Navigate to any webpage with forms
2. Click the Form Extractor extension icon
3. Click "Extract Forms" button
4. View extracted data in the organized tabs

### Understanding the Tabs

**Overview Tab**
- Shows summary statistics
- Lists all detected forms
- Displays element counts by type

**Elements Tab**
- Shows detailed element information
- Search/filter elements
- Copy XPath selectors with one click
- View all attributes and options

**Dependencies Tab**
- Lists detected field relationships
- Shows which fields control others
- Displays conditional logic

### Exporting Data

The extension supports two export formats:

**JSON Export**
1. After extraction, click "Export JSON"
2. Downloads a comprehensive JSON file with all data
3. Includes metadata, forms, elements, and dependencies
4. Perfect for programmatic processing

**CSV Export**
1. After extraction, click "Export CSV"  
2. Downloads a CSV file with one row per form field
3. Columns include: Form Name, Label, Type, ID, Name, XPath, CSS Selector, Placeholder, Required, Disabled, Value, Options, ARIA Label
4. Easy to open in Excel/Google Sheets for analysis
5. Perfect for documentation and test case planning

## Testing

The extension includes a test page (`test-form.html`) with:
- Multiple form types
- Conditional fields
- Dropdown menus
- Radio buttons and checkboxes
- Field dependencies

**To test:**
1. Open `test-form.html` in Chrome
2. Click the extension icon
3. Extract forms and verify data

## Data Structure

Exported JSON structure:

```json
{
  "metadata": {
    "url": "https://example.com",
    "title": "Page Title",
    "timestamp": "2026-01-13T...",
    "totalForms": 1,
    "totalElements": 15,
    "totalDependencies": 3
  },
  "forms": [
    {
      "id": "registrationForm",
      "name": "registrationForm",
      "action": "/submit",
      "method": "POST",
      "xpath": "//form[@id='registrationForm']",
      "elements": [...]
    }
  ],
  "dependencies": [
    {
      "source": "#country",
      "target": "#timezone",
      "type": "enables"
    }
  ]
}
```

## Element Data Fields

Each extracted element includes:

- `type` - Element type (text, select, checkbox, etc.)
- `id` - Element ID attribute
- `name` - Element name attribute
- `xpath` - Optimized XPath selector
- `cssSelector` - CSS selector
- `label` - Associated label text
- `placeholder` - Placeholder text
- `required` - Required field flag
- `disabled` - Disabled state
- `options` - Array of options (for select elements)
- `attributes` - All HTML attributes

## Use Cases

### Selenium Automation

Use extracted data to:
1. Generate Selenium test scripts
2. Create page object models
3. Map element locators
4. Document form structure
5. Identify test cases based on dependencies

### Example Selenium Code

```python
# Using extracted XPath
driver.find_element(By.XPATH, "//input[@id='fullName']").send_keys("John Doe")
driver.find_element(By.XPATH, "//select[@id='country']").click()
```

## File Structure

```
form/
├── manifest.json           # Extension manifest (Manifest V3)
├── popup.html             # Extension popup UI
├── popup.css              # Popup styling
├── popup.js               # Popup logic
├── content.js             # Main extraction script
├── xpath-generator.js     # XPath generation utility
├── dependency-detector.js # Dependency analysis
├── data-processor.js      # Data processing & formatting
├── test-form.html         # Test page
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## Browser Compatibility

- ✅ Chrome (Manifest V3)
- ✅ Edge (Chromium-based)
- ⚠️ Firefox (requires Manifest V2 adaptation)
- ⚠️ Safari (requires conversion)

## Troubleshooting

**Extension not extracting data?**
- Ensure Developer mode is enabled
- Reload the extension after code changes
- Check browser console for errors

**No forms detected?**
- Extension also detects standalone form elements
- Check if elements are in shadow DOM (not currently supported)
- Verify page has loaded completely

**Dependencies not detected?**
- Extension uses heuristics and data attributes
- Add `data-controls`, `data-enables`, or `data-shows` attributes for better detection
- Complex JavaScript logic may not be detected

## Advanced Features

### Custom Data Attributes

Add these attributes to your forms for better dependency detection:

```html
<!-- Indicate control relationships -->
<input type="checkbox" data-controls="advancedOptions">
<div id="advancedOptions">...</div>

<!-- Indicate enabling relationships -->
<select data-enables="dependentField">...</select>
<input id="dependentField">

<!-- Indicate visibility relationships -->
<input type="radio" data-shows="conditionalSection">
<div id="conditionalSection">...</div>
```

## Contributing

Contributions welcome! Areas for improvement:
- Shadow DOM support
- More dependency detection patterns
- Additional export formats (CSV, Python code)
- Firefox compatibility
- Automated test generation

## License

MIT License - Feel free to use in your projects

## Support

For issues or questions:
1. Check the test-form.html example
2. Review browser console for errors
3. Verify extension permissions

---

**Made for Selenium automation enthusiasts 🚀**
