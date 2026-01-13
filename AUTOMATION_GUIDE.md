# Form Automation JSON Template

## Overview
This directory contains JSON templates and Python scripts for automated form filling with Selenium.

## Files

### `automation_data_template.json`
Comprehensive JSON template with all form element types and empty values ready for data entry.

**Element Types Included:**
- ✅ Text inputs (text, email, tel, password, date, number)
- ✅ Textareas
- ✅ Dropdowns (select elements)
- ✅ Radio button groups
- ✅ Checkbox groups
- ✅ Single checkboxes
- ✅ File uploads
- ✅ React Select dropdowns
- ✅ Buttons (submit, button)

**Structure:**
```json
{
  "form_data": {
    "form_name": "Sample Registration Form",
    "elements": {
      "text_inputs": [...],
      "dropdowns": [...],
      "radio_groups": [...],
      ...
    }
  },
  "test_scenarios": [...]
}
```

### `form_automation.py`
Python script using Selenium that:
- Loads JSON data file
- Fills all form elements automatically
- Supports test scenarios with data overrides
- Handles all element types

## Usage

### 1. Extract Form Data
Use the browser extension to extract form structure:
```bash
1. Open extension on target form page
2. Click "Extract Forms"
3. Click "Export JSON"
```

### 2. Create Test Data
Edit `automation_data_template.json` to add your test values:

```json
{
  "text_inputs": [
    {
      "id": "firstName",
      "value": "John"  // ← Add test data here
    }
  ]
}
```

### 3. Run Automation
```python
from form_automation import FormAutomation
from selenium import webdriver

driver = webdriver.Chrome()
driver.get('YOUR_FORM_URL')

automation = FormAutomation(driver, 'automation_data_template.json')
automation.fill_form()
automation.submit_form()
```

## Element Type Examples

### Text Input
```json
{
  "id": "firstName",
  "name": "firstName",
  "xpath": "//*[@id='firstName']",
  "css_selector": "#firstName",
  "value": "",  // Fill this for automation
  "type": "text"
}
```

### Dropdown
```json
{
  "id": "country",
  "selected_value": "",  // Fill with option value
  "selected_index": null,  // Or use index
  "selected_text": "",  // Or use visible text
  "type": "select",
  "options": [
    {"index": 0, "value": "us", "text": "United States"},
    {"index": 1, "value": "uk", "text": "United Kingdom"}
  ]
}
```

### Radio Group
```json
{
  "group_name": "gender",
  "selected_value": "",  // Set to "male", "female", or "other"
  "type": "radio",
  "options": [
    {"id": "gender-male", "value": "male", "label": "Male"},
    {"id": "gender-female", "value": "female", "label": "Female"}
  ]
}
```

### Checkbox Group
```json
{
  "group_name": "interests",
  "selected_values": [],  // Add values: ["sports", "music"]
  "type": "checkbox",
  "options": [
    {"id": "interest-sports", "value": "sports", "label": "Sports"},
    {"id": "interest-music", "value": "music", "label": "Music"}
  ]
}
```

### Single Checkbox
```json
{
  "id": "terms",
  "checked": false,  // Set to true to check
  "type": "checkbox",
  "label": "I agree to terms"
}
```

### React Select
```json
{
  "id": "react-select-3-input",
  "selected_text": "",  // Set to option text: "NCR"
  "type": "react-select",
  "options": [
    {"index": 0, "value": "NCR", "label": "NCR"}
  ]
}
```

## Test Scenarios

Create multiple test scenarios in the same JSON:

```json
{
  "test_scenarios": [
    {
      "scenario_name": "valid_user",
      "data_overrides": {
        "text_inputs": {
          "email": "user@example.com"
        },
        "radio_groups": {
          "gender": "male"
        }
      }
    },
    {
      "scenario_name": "invalid_email",
      "data_overrides": {
        "text_inputs": {
          "email": "invalid-email.com"
        }
      },
      "expected_result": "validation_error"
    }
  ]
}
```

Run specific scenario:
```python
automation.fill_form(scenario_name='valid_user')
```

## Workflow

1. **Extract** → Use extension to get form structure
2. **Export** → Download JSON with selectors
3. **Map** → Copy to `automation_data_template.json`
4. **Fill** → Add test values
5. **Run** → Execute `form_automation.py`
6. **Test** → Verify form submission

## Tips

- Keep empty values for negative testing
- Use test scenarios for different user types
- Include XPath AND CSS selectors for fallback
- Add file paths as absolute paths
- Test dependent dropdowns separately
- Use React selectors for React applications

## Dependencies

```bash
pip install selenium
```

Optional for better waiting:
```bash
pip install webdriver-manager
```

## Advanced Usage

### Custom Data Loading
```python
# Load from custom JSON
data = automation.load_data('my_test_data.json')

# Modify data programmatically
data['form_data']['elements']['text_inputs'][0]['value'] = 'Dynamic Value'

# Fill with modified data
automation.data = data
automation.fill_form()
```

### Partial Form Filling
```python
# Fill only text inputs
for text_input in automation.data['form_data']['elements']['text_inputs']:
    automation.fill_text_input(text_input)

# Fill only dropdowns
for dropdown in automation.data['form_data']['elements']['dropdowns']:
    automation.fill_dropdown(dropdown)
```

### Error Handling
```python
try:
    automation.fill_form()
    automation.submit_form()
except Exception as e:
    print(f"Form filling failed: {e}")
    driver.save_screenshot('error.png')
```

---

**Ready to automate!** 🚀
