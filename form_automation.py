"""
Form Automation Data Handler
Loads JSON test data and fills forms using Selenium WebDriver
"""

import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
import time


class FormAutomation:
    def __init__(self, driver, data_file='automation_data_template.json'):
        """
        Initialize form automation with Selenium driver and data file
        
        Args:
            driver: Selenium WebDriver instance
            data_file: Path to JSON data file
        """
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)
        self.data = self.load_data(data_file)
    
    def load_data(self, file_path):
        """Load test data from JSON file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def fill_text_input(self, element_data):
        """Fill text input field"""
        element = self.wait.until(
            EC.presence_of_element_located((By.ID, element_data['id']))
        )
        element.clear()
        if element_data['value']:
            element.send_keys(element_data['value'])
        print(f"✓ Filled {element_data['id']}: {element_data['value']}")
    
    def fill_dropdown(self, dropdown_data):
        """Select dropdown option"""
        element = self.wait.until(
            EC.presence_of_element_located((By.ID, dropdown_data['id']))
        )
        select = Select(element)
        
        if dropdown_data['selected_value']:
            select.select_by_value(dropdown_data['selected_value'])
        elif dropdown_data['selected_index'] is not None:
            select.select_by_index(dropdown_data['selected_index'])
        elif dropdown_data['selected_text']:
            select.select_by_visible_text(dropdown_data['selected_text'])
        
        print(f"✓ Selected {dropdown_data['id']}: {dropdown_data['selected_value']}")
    
    def fill_radio_group(self, radio_data):
        """Select radio button from group"""
        if not radio_data['selected_value']:
            return
        
        for option in radio_data['options']:
            if option['value'] == radio_data['selected_value']:
                element = self.driver.find_element(By.ID, option['id'])
                element.click()
                print(f"✓ Selected radio {radio_data['group_name']}: {option['label']}")
                break
    
    def fill_checkbox_group(self, checkbox_data):
        """Check/uncheck checkboxes in group"""
        for option in checkbox_data['options']:
            element = self.driver.find_element(By.ID, option['id'])
            should_check = option['value'] in checkbox_data['selected_values']
            
            if should_check and not element.is_selected():
                element.click()
                print(f"✓ Checked {option['label']}")
            elif not should_check and element.is_selected():
                element.click()
                print(f"✓ Unchecked {option['label']}")
    
    def fill_single_checkbox(self, checkbox_data):
        """Check/uncheck single checkbox"""
        element = self.driver.find_element(By.ID, checkbox_data['id'])
        
        if checkbox_data['checked'] and not element.is_selected():
            element.click()
            print(f"✓ Checked {checkbox_data['label']}")
        elif not checkbox_data['checked'] and element.is_selected():
            element.click()
            print(f"✓ Unchecked {checkbox_data['label']}")
    
    def fill_textarea(self, textarea_data):
        """Fill textarea field"""
        element = self.driver.find_element(By.ID, textarea_data['id'])
        element.clear()
        if textarea_data['value']:
            element.send_keys(textarea_data['value'])
        print(f"✓ Filled textarea {textarea_data['id']}")
    
    def upload_file(self, file_data):
        """Upload file"""
        if not file_data['file_path']:
            return
        
        element = self.driver.find_element(By.ID, file_data['id'])
        element.send_keys(file_data['file_path'])
        print(f"✓ Uploaded file to {file_data['id']}: {file_data['file_path']}")
    
    def fill_react_select(self, react_select_data):
        """Fill React Select dropdown"""
        if not react_select_data['selected_text']:
            return
        
        # Click to open dropdown
        container = self.driver.find_element(By.CSS_SELECTOR, react_select_data['container_selector'])
        container.click()
        time.sleep(0.5)
        
        # Find and click option
        options = self.driver.find_elements(By.CSS_SELECTOR, '.react-select__option')
        for option in options:
            if option.text == react_select_data['selected_text']:
                option.click()
                print(f"✓ Selected React Select: {react_select_data['selected_text']}")
                break
    
    def click_button(self, button_data):
        """Click button"""
        element = self.driver.find_element(By.ID, button_data['id'])
        element.click()
        print(f"✓ Clicked {button_data['text']} button")
    
    def fill_form(self, scenario_name=None):
        """
        Fill entire form with data from JSON
        
        Args:
            scenario_name: Optional test scenario to apply data overrides
        """
        elements = self.data['form_data']['elements']
        
        # Apply scenario overrides if specified
        if scenario_name:
            scenario = next((s for s in self.data['test_scenarios'] if s['scenario_name'] == scenario_name), None)
            if scenario:
                self.apply_scenario_overrides(elements, scenario['data_overrides'])
        
        print(f"\n=== Filling Form: {self.data['form_data']['form_name']} ===\n")
        
        # Fill text inputs
        for text_input in elements.get('text_inputs', []):
            self.fill_text_input(text_input)
        
        # Fill password inputs
        for password in elements.get('password_inputs', []):
            self.fill_text_input(password)
        
        # Fill date inputs
        for date_input in elements.get('date_inputs', []):
            self.fill_text_input(date_input)
        
        # Fill number inputs
        for number_input in elements.get('number_inputs', []):
            self.fill_text_input(number_input)
        
        # Fill textareas
        for textarea in elements.get('textareas', []):
            self.fill_textarea(textarea)
        
        # Fill dropdowns
        for dropdown in elements.get('dropdowns', []):
            self.fill_dropdown(dropdown)
        
        # Fill radio groups
        for radio_group in elements.get('radio_groups', []):
            self.fill_radio_group(radio_group)
        
        # Fill checkbox groups
        for checkbox_group in elements.get('checkbox_groups', []):
            self.fill_checkbox_group(checkbox_group)
        
        # Fill single checkboxes
        for checkbox in elements.get('single_checkboxes', []):
            self.fill_single_checkbox(checkbox)
        
        # Upload files
        for file_upload in elements.get('file_uploads', []):
            self.upload_file(file_upload)
        
        # Fill React Select dropdowns
        for react_select in elements.get('react_select_dropdowns', []):
            self.fill_react_select(react_select)
        
        print(f"\n=== Form Filled Successfully ===\n")
    
    def apply_scenario_overrides(self, elements, overrides):
        """Apply test scenario data overrides"""
        # Override text inputs
        if 'text_inputs' in overrides:
            for text_input in elements.get('text_inputs', []):
                field_id = text_input['id']
                if field_id in overrides['text_inputs']:
                    text_input['value'] = overrides['text_inputs'][field_id]
        
        # Override dropdowns
        if 'dropdowns' in overrides:
            for dropdown in elements.get('dropdowns', []):
                field_id = dropdown['id']
                if field_id in overrides['dropdowns']:
                    override = overrides['dropdowns'][field_id]
                    dropdown['selected_value'] = override.get('value', '')
                    dropdown['selected_text'] = override.get('text', '')
        
        # Override radio groups
        if 'radio_groups' in overrides:
            for radio_group in elements.get('radio_groups', []):
                group_name = radio_group['group_name']
                if group_name in overrides['radio_groups']:
                    radio_group['selected_value'] = overrides['radio_groups'][group_name]
        
        # Override checkboxes
        if 'single_checkboxes' in overrides:
            for checkbox in elements.get('single_checkboxes', []):
                field_id = checkbox['id']
                if field_id in overrides['single_checkboxes']:
                    checkbox['checked'] = overrides['single_checkboxes'][field_id]
    
    def submit_form(self):
        """Click submit button"""
        submit_btn = next(
            (btn for btn in self.data['form_data']['elements']['buttons'] if btn['type'] == 'submit'),
            None
        )
        if submit_btn:
            self.click_button(submit_btn)


# Example usage
if __name__ == '__main__':
    # Initialize driver
    driver = webdriver.Chrome()
    
    try:
        # Navigate to form
        driver.get('https://demoqa.com/automation-practice-form')
        driver.maximize_window()
        
        # Initialize automation
        automation = FormAutomation(driver, 'automation_data_template.json')
        
        # Fill form with valid data scenario
        automation.fill_form(scenario_name='valid_registration')
        
        # Submit form
        # automation.submit_form()
        
        # Wait to see results
        time.sleep(5)
        
    finally:
        driver.quit()
