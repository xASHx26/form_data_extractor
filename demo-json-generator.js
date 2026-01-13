// Demo JSON Generator for Automation
const DemoJsonGenerator = {
    /**
     * Generate simple test-case oriented JSON template from extracted data
     */
    generateDemoJson(data) {
        const formData = data.forms[0]; // Use first form
        const elements = data.elements;

        // Build field map with best identifier as key
        const fields = {};
        const selectors = {}; // Store selectors separately for reference

        elements.forEach(element => {
            const key = this.getBestKey(element);
            const fieldData = this.createFieldData(element);

            if (fieldData) {
                fields[key] = fieldData.value;
                selectors[key] = fieldData.selectors;
            }
        });

        // Create template with test cases
        const template = {
            test_cases: [
                {
                    name: "valid_submission",
                    description: "Test with valid data for all required fields",
                    data: { ...fields },
                    expected: "success"
                },
                {
                    name: "missing_required_fields",
                    description: "Test with missing required fields",
                    data: this.createEmptyFieldsCopy(fields),
                    expected: "validation_error"
                },
                {
                    name: "invalid_data_format",
                    description: "Test with invalid data formats",
                    data: { ...fields },
                    expected: "validation_error"
                }
            ],
            selectors_reference: selectors,
            form_info: {
                form_name: formData.name,
                form_id: formData.id,
                form_action: formData.action,
                form_method: formData.method,
                total_elements: elements.length
            }
        };

        return template;
    },

    /**
     * Get best key name for element (label > id > name > type)
     */
    getBestKey(element) {
        // Prioritize label if meaningful
        if (element.label && element.label.length > 0 && !element.label.match(/^\s*$/)) {
            return this.sanitizeKey(element.label);
        }

        // Use ID if available
        if (element.id && element.id.length > 0) {
            return this.sanitizeKey(element.id);
        }

        // Use name if available
        if (element.name && element.name.length > 0) {
            return this.sanitizeKey(element.name);
        }

        // Use placeholder as fallback
        if (element.placeholder && element.placeholder.length > 0) {
            return this.sanitizeKey(element.placeholder);
        }

        // Last resort: type + index
        return `${element.type}_${element.elementIndex}`;
    },

    /**
     * Sanitize key to be valid identifier
     */
    sanitizeKey(str) {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .substring(0, 50); // Limit length
    },

    /**
     * Create field data based on element type
     */
    createFieldData(element) {
        const selectors = {
            id: element.id,
            name: element.name,
            xpath: element.xpath,
            css_selector: element.cssSelector,
            type: element.type,
            label: element.label
        };

        // Skip buttons
        if (element.type === 'submit' || element.type === 'button') {
            return null;
        }

        // Text-based inputs
        if (['text', 'email', 'password', 'tel', 'url', 'search'].includes(element.type)) {
            return {
                value: "",
                selectors: { ...selectors, input_type: "text" }
            };
        }

        // Number inputs
        if (element.type === 'number') {
            return {
                value: "",
                selectors: { ...selectors, input_type: "number", min: element.attributes?.min, max: element.attributes?.max }
            };
        }

        // Date inputs
        if (element.type === 'date') {
            return {
                value: "",
                selectors: { ...selectors, input_type: "date", format: "YYYY-MM-DD" }
            };
        }

        // Textarea
        if (element.type === 'textarea') {
            return {
                value: "",
                selectors: { ...selectors, input_type: "textarea" }
            };
        }

        // Dropdowns
        if (element.tagName === 'select' || (element.options && element.options.length > 0 && !element.type.includes('radio') && !element.type.includes('checkbox'))) {
            const options = element.options || [];
            return {
                value: "",
                selectors: {
                    ...selectors,
                    input_type: "select",
                    options: options.map(opt => ({ value: opt.value, text: opt.label || opt.text }))
                }
            };
        }

        // Radio buttons - group by name
        if (element.type === 'radio') {
            return {
                value: "",
                selectors: {
                    ...selectors,
                    input_type: "radio",
                    radio_value: element.value,
                    group_name: element.name
                }
            };
        }

        // Checkboxes
        if (element.type === 'checkbox') {
            return {
                value: false,
                selectors: {
                    ...selectors,
                    input_type: "checkbox",
                    checkbox_value: element.value
                }
            };
        }

        // File upload
        if (element.type === 'file') {
            return {
                value: "",
                selectors: {
                    ...selectors,
                    input_type: "file",
                    accepted_types: element.attributes?.accept
                }
            };
        }

        // Default
        return {
            value: "",
            selectors: selectors
        };
    },

    /**
     * Create copy of fields with all empty values
     */
    createEmptyFieldsCopy(fields) {
        const empty = {};
        Object.keys(fields).forEach(key => {
            empty[key] = "";
        });
        return empty;
    }
};

// Make available globally
window.DemoJsonGenerator = DemoJsonGenerator;
