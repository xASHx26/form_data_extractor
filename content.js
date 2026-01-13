// Main Content Script - Extracts form data from the page
(function () {
    'use strict';

    // Main extraction function
    async function extractFormData() {
        console.log('Form Extractor: Starting extraction...');

        const forms = document.querySelectorAll('form');
        const formsData = [];

        if (forms.length === 0) {
            // Look for form elements not inside form tags
            console.log('No <form> tags found. Searching for standalone form elements...');
            const standaloneElements = document.querySelectorAll(
                'input:not(form input), select:not(form select), textarea:not(form textarea), button:not(form button)'
            );

            if (standaloneElements.length > 0) {
                const standaloneFormData = await extractFormElements(document.body, {
                    id: 'standalone',
                    name: 'Standalone Elements',
                    action: '',
                    method: ''
                });
                formsData.push(standaloneFormData);
            }
        } else {
            // Extract each form
            for (let index = 0; index < forms.length; index++) {
                const form = forms[index];
                const formData = await extractFormElements(form, {
                    id: form.id || `form_${index}`,
                    name: form.name || form.id || `Form ${index + 1}`,
                    action: form.action || '',
                    method: form.method || 'GET'
                });
                formsData.push(formData);
            }
        }

        // Detect dependencies
        const detector = new DependencyDetector();
        const dependencies = detector.analyzeForms(Array.from(forms).length > 0 ? forms : [document.body]);

        // Process all data
        const processedData = DataProcessor.process(formsData, dependencies);

        console.log('Form Extractor: Extraction complete', processedData);
        return processedData;
    }

    // Extract elements from a form or container
    async function extractFormElements(container, formInfo) {
        const elements = [];
        const formElements = container.querySelectorAll(
            'input, select, textarea, button[type="submit"], button[type="button"]'
        );

        for (const element of formElements) {
            const elementData = await extractElementData(element, elements.length);
            elements.push(elementData);
        }

        return {
            ...formInfo,
            xpath: XPathGenerator.generate(container),
            cssSelector: XPathGenerator.getCssSelector(container),
            elements: elements
        };
    }

    // Extract data from a single element
    async function extractElementData(element, index) {
        const data = {
            tagName: element.tagName.toLowerCase(),
            type: element.type || element.tagName.toLowerCase(),
            id: element.id || '',
            name: element.name || '',
            value: element.value || '',
            placeholder: element.placeholder || '',
            required: element.required || false,
            disabled: element.disabled || false,
            readonly: element.readOnly || false,
            xpath: XPathGenerator.generate(element),
            cssSelector: XPathGenerator.getCssSelector(element),
            reactSelectors: XPathGenerator.getReactSelectors(element),
            attributes: extractAttributes(element),
            ariaLabel: element.getAttribute('aria-label') || '',
            ariaDescribedBy: element.getAttribute('aria-describedby') || ''
        };

        // Get associated label
        data.label = findLabel(element);

        // Extract options for select elements
        if (element.tagName === 'SELECT') {
            data.options = extractSelectOptions(element);
            data.dropdownDependency = detectDropdownDependency(element);
        }

        // Extract options for custom dropdowns (React Select, etc.) - ASYNC
        if (element.id && (element.id.includes('select') || element.id.includes('Select'))) {
            const customOptions = await extractCustomDropdownOptions(element);
            if (customOptions.length > 0) {
                data.options = customOptions;
                data.dropdownType = 'custom-react-select';
            }
            data.dropdownDependency = detectDropdownDependency(element);
        }

        // Extract options for radio/checkbox groups
        if (element.type === 'radio' || element.type === 'checkbox') {
            data.groupOptions = extractRadioCheckboxGroup(element);
        }

        return data;
    }

    // Extract all attributes from an element
    function extractAttributes(element) {
        const attributes = {};
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            attributes[attr.name] = attr.value;
        }
        return attributes;
    }

    // Find associated label for an input
    function findLabel(element) {
        // Method 1: Label with for attribute
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent.trim();
        }

        // Method 2: Parent label
        const parentLabel = element.closest('label');
        if (parentLabel) {
            // Get text excluding nested elements
            return parentLabel.textContent.trim();
        }

        // Method 3: Previous sibling label
        let prev = element.previousElementSibling;
        while (prev) {
            if (prev.tagName === 'LABEL') {
                return prev.textContent.trim();
            }
            prev = prev.previousElementSibling;
        }

        // Method 4: Look for nearby text
        const parent = element.parentElement;
        if (parent) {
            const textBefore = [];
            for (let child of parent.childNodes) {
                if (child === element) break;
                if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    textBefore.push(child.textContent.trim());
                }
            }
            if (textBefore.length > 0) {
                return textBefore.join(' ');
            }
        }

        return '';
    }

    // Extract options from select element
    function extractSelectOptions(selectElement) {
        const options = [];
        const optionElements = selectElement.querySelectorAll('option');

        optionElements.forEach((option, index) => {
            options.push({
                index: index,
                value: option.value,
                text: option.textContent.trim(),
                label: option.textContent.trim(),
                selected: option.selected,
                disabled: option.disabled
            });
        });

        return options;
    }

    // Extract options from React Select or custom dropdowns
    async function extractCustomDropdownOptions(element) {
        return new Promise((resolve) => {
            const options = [];

            // Try to find the dropdown container
            let container = element.closest('[class*="select"]') ||
                element.closest('[class*="Select"]') ||
                element.closest('[id*="select"]') ||
                element.parentElement;

            if (!container) {
                resolve(options);
                return;
            }

            // Function to find and extract options from menu
            const extractFromMenu = () => {
                // Look for React Select menu (could be anywhere in document)
                const menuSelectors = [
                    '.react-select__menu',
                    '[class*="menu"]',
                    '[class*="Menu"]',
                    '[role="listbox"]',
                    '[class*="options"]'
                ];

                let menu = null;
                for (const selector of menuSelectors) {
                    const menus = document.querySelectorAll(selector);
                    // Find the most recently added or visible menu
                    for (let i = menus.length - 1; i >= 0; i--) {
                        if (menus[i].offsetParent !== null) {
                            menu = menus[i];
                            break;
                        }
                    }
                    if (menu) break;
                }

                if (menu) {
                    const optionSelectors = [
                        '[role="option"]',
                        '.react-select__option',
                        '[class*="option"]',
                        '[class*="Option"]'
                    ];

                    let optionElements = [];
                    for (const selector of optionSelectors) {
                        optionElements = menu.querySelectorAll(selector);
                        if (optionElements.length > 0) break;
                    }

                    optionElements.forEach((option, index) => {
                        const value = option.getAttribute('data-value') ||
                            option.getAttribute('value') ||
                            option.textContent.trim();

                        options.push({
                            index: index,
                            value: value,
                            text: option.textContent.trim(),
                            label: option.textContent.trim(),
                            selected: option.getAttribute('aria-selected') === 'true' ||
                                option.classList.contains('selected'),
                            disabled: option.getAttribute('aria-disabled') === 'true' ||
                                option.classList.contains('disabled')
                        });
                    });
                }

                return options.length > 0;
            };

            // First, try to find existing options
            if (extractFromMenu()) {
                resolve(options);
                return;
            }

            // If no options found, try to trigger the dropdown
            const control = container.querySelector('[class*="control"]') ||
                container.querySelector('input') ||
                element;

            if (control && !element.disabled) {
                // Try multiple event types
                control.focus();
                control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                control.click();
                control.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

                // Wait for options to appear
                setTimeout(() => {
                    extractFromMenu();

                    // Close the dropdown
                    document.body.click();

                    resolve(options);
                }, 300);
            } else {
                resolve(options);
            }
        });
    }

    // Detect if dropdown is dependent on another
    function detectDropdownDependency(element) {
        const dependencies = {
            dependsOn: null,
            dependentFields: []
        };

        // Check if element is disabled with data attribute indicating dependency
        if (element.disabled) {
            const container = element.closest('[data-depends-on]');
            if (container) {
                dependencies.dependsOn = container.getAttribute('data-depends-on');
            }
        }

        // Check for common patterns in id/class names
        const id = element.id || '';
        const className = element.className || '';

        // Pattern: state/city dependency
        if (id.includes('city') || className.includes('city')) {
            const stateField = document.querySelector('[id*="state"], [class*="state"]');
            if (stateField && stateField !== element) {
                dependencies.dependsOn = stateField.id || 'state-field';
            }
        }

        if (id.includes('district') || className.includes('district')) {
            const stateField = document.querySelector('[id*="state"], [class*="state"]');
            if (stateField) {
                dependencies.dependsOn = stateField.id || 'state-field';
            }
        }

        return dependencies;
    }

    // Extract radio/checkbox group options
    function extractRadioCheckboxGroup(element) {
        if (!element.name) return [];

        const selector = `input[name="${element.name}"]`;
        const groupElements = document.querySelectorAll(selector);
        const options = [];

        groupElements.forEach((el, index) => {
            const label = findLabel(el);
            options.push({
                index: index,
                value: el.value,
                label: label,
                checked: el.checked,
                disabled: el.disabled,
                id: el.id || ''
            });
        });

        return options;
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractForms') {
            extractFormData().then(data => {
                sendResponse({ success: true, data: data });
            }).catch(error => {
                console.error('Form Extractor Error:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true; // Keep channel open for async response
        }
    });

    console.log('Form Extractor: Content script loaded');
})();
