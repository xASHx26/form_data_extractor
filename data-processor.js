// Data Processor - Organizes and structures extracted form data
class DataProcessor {
    /**
     * Process raw form data into structured format
     */
    static process(formsData, dependencies) {
        const processed = {
            metadata: {
                url: window.location.href,
                title: document.title,
                timestamp: new Date().toISOString(),
                totalForms: formsData.length,
                totalElements: 0,
                totalDependencies: dependencies.length
            },
            forms: [],
            dependencies: dependencies,
            elements: []
        };

        formsData.forEach((formData, index) => {
            const processedForm = this.processForm(formData, index);
            processed.forms.push(processedForm);
            processed.elements.push(...processedForm.elements);
            processed.metadata.totalElements += processedForm.elements.length;
        });

        return processed;
    }

    /**
     * Process a single form
     */
    static processForm(formData, index) {
        return {
            formIndex: index,
            id: formData.id || `form_${index}`,
            name: formData.name || `Unnamed Form ${index + 1}`,
            action: formData.action || '',
            method: formData.method || 'GET',
            xpath: formData.xpath,
            cssSelector: formData.cssSelector,
            elementCount: formData.elements.length,
            elements: formData.elements.map((el, elIndex) =>
                this.processElement(el, index, elIndex)
            ),
            statistics: this.calculateFormStats(formData.elements)
        };
    }

    /**
     * Process a single element
     */
    static processElement(element, formIndex, elementIndex) {
        return {
            formIndex: formIndex,
            elementIndex: elementIndex,
            type: element.type,
            tagName: element.tagName,
            id: element.id || '',
            name: element.name || '',
            value: element.value || '',
            placeholder: element.placeholder || '',
            label: element.label || '',
            required: element.required || false,
            disabled: element.disabled || false,
            readonly: element.readonly || false,
            xpath: element.xpath,
            cssSelector: element.cssSelector,
            reactSelectors: element.reactSelectors || {},
            attributes: element.attributes || {},
            options: element.options || [],
            dropdownDependency: element.dropdownDependency || null,
            dropdownType: element.dropdownType || null,
            ariaLabel: element.ariaLabel || '',
            ariaDescribedBy: element.ariaDescribedBy || ''
        };
    }

    /**
     * Calculate statistics for a form
     */
    static calculateFormStats(elements) {
        const stats = {
            total: elements.length,
            byType: {},
            required: 0,
            disabled: 0,
            withId: 0,
            withName: 0,
            withLabel: 0
        };

        elements.forEach(el => {
            // Count by type
            const type = el.type || el.tagName.toLowerCase();
            stats.byType[type] = (stats.byType[type] || 0) + 1;

            // Count attributes
            if (el.required) stats.required++;
            if (el.disabled) stats.disabled++;
            if (el.id) stats.withId++;
            if (el.name) stats.withName++;
            if (el.label) stats.withLabel++;
        });

        return stats;
    }

    /**
     * Export data to JSON string
     */
    static exportToJSON(data, pretty = true) {
        return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    }

    /**
     * Generate summary report
     */
    static generateSummary(data) {
        const summary = [];

        summary.push(`Form Extraction Report`);
        summary.push(`URL: ${data.metadata.url}`);
        summary.push(`Timestamp: ${data.metadata.timestamp}`);
        summary.push(`\nSummary:`);
        summary.push(`- Total Forms: ${data.metadata.totalForms}`);
        summary.push(`- Total Elements: ${data.metadata.totalElements}`);
        summary.push(`- Total Dependencies: ${data.metadata.totalDependencies}`);

        summary.push(`\nForms:`);
        data.forms.forEach((form, i) => {
            summary.push(`  ${i + 1}. ${form.name} (${form.elementCount} elements)`);
        });

        if (data.dependencies.length > 0) {
            summary.push(`\nDependencies:`);
            data.dependencies.forEach((dep, i) => {
                summary.push(`  ${i + 1}. ${dep.source} ${dep.type} ${dep.target}`);
            });
        }

        return summary.join('\n');
    }

    /**
     * Filter elements by criteria
     */
    static filterElements(elements, criteria) {
        return elements.filter(el => {
            if (criteria.type && el.type !== criteria.type) return false;
            if (criteria.hasId && !el.id) return false;
            if (criteria.hasName && !el.name) return false;
            if (criteria.required !== undefined && el.required !== criteria.required) return false;
            if (criteria.disabled !== undefined && el.disabled !== criteria.disabled) return false;
            if (criteria.search) {
                const searchLower = criteria.search.toLowerCase();
                const searchable = [
                    el.id, el.name, el.label, el.placeholder, el.type
                ].join(' ').toLowerCase();
                if (!searchable.includes(searchLower)) return false;
            }
            return true;
        });
    }

    /**
     * Group elements by type
     */
    static groupByType(elements) {
        const grouped = {};
        elements.forEach(el => {
            const type = el.type || 'other';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(el);
        });
        return grouped;
    }

    /**
     * Export data to CSV format
     * Each field becomes a row in the CSV with columns:
     * Label, Type, ID, Name, XPath, CSS Selector, React Selectors, Placeholder, Required, Disabled, Value, Options
     */
    static exportToCSV(data) {
        const rows = [];

        // Add header row
        const headers = [
            'Form Name',
            'Label',
            'Type',
            'ID',
            'Name',
            'XPath',
            'CSS Selector',
            'React TestID',
            'React Role',
            'React Label',
            'React Placeholder',
            'Placeholder',
            'Required',
            'Disabled',
            'Value',
            'Options',
            'Depends On',
            'ARIA Label'
        ];
        rows.push(headers);

        // Add data rows - one row per element
        data.elements.forEach(element => {
            // Get form name
            const form = data.forms.find(f => f.formIndex === element.formIndex);
            const formName = form ? form.name : 'Unknown Form';

            // Format options if present (for dropdowns)
            let optionsStr = '';
            if (element.options && element.options.length > 0) {
                optionsStr = element.options
                    .map(opt => `[${opt.index}] ${opt.label || opt.text}=${opt.value}`)
                    .join('; ');
            }

            // Get dependency info
            let dependsOnStr = '';
            if (element.dropdownDependency && element.dropdownDependency.dependsOn) {
                dependsOnStr = element.dropdownDependency.dependsOn;
            }

            // Extract React selectors
            const react = element.reactSelectors || {};

            const row = [
                formName,
                element.label || '',
                element.type || '',
                element.id || '',
                element.name || '',
                element.xpath || '',
                element.cssSelector || '',
                react.dataTestId || react.dataTest || '',
                react.role || '',
                react.labelText || '',
                react.placeholderText || '',
                element.placeholder || '',
                element.required ? 'Yes' : 'No',
                element.disabled ? 'Yes' : 'No',
                element.value || '',
                optionsStr,
                dependsOnStr,
                element.ariaLabel || ''
            ];

            rows.push(row);
        });

        // Convert to CSV string
        return this.convertArrayToCSV(rows);
    }

    /**
     * Convert 2D array to CSV string
     */
    static convertArrayToCSV(data) {
        return data.map(row => {
            return row.map(cell => {
                // Escape double quotes and wrap in quotes if contains comma, quote, or newline
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return '"' + cellStr.replace(/"/g, '""') + '"';
                }
                return cellStr;
            }).join(',');
        }).join('\n');
    }
}

// Make available globally
window.DataProcessor = DataProcessor;
