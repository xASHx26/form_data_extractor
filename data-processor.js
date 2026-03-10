// Data Processor - Organizes and structures extracted form data
class DataProcessor {
    /**
     * Process raw form data into structured format
     */
    static process(formsData, dependencies, hiddenDiscovery = { discoveries: [], hiddenElements: [] }) {
        // Enhance static dependencies with dynamic discoveries
        const enhanced = DependencyDetector.enhanceWithDiscovery(dependencies, hiddenDiscovery.discoveries);

        const processed = {
            metadata: {
                url: window.location.href,
                title: document.title,
                timestamp: new Date().toISOString(),
                totalForms: formsData.length,
                totalElements: 0,
                totalDependencies: enhanced.dependencies.length,
                totalHiddenDiscovered: hiddenDiscovery.hiddenElements.length
            },
            forms: [],
            dependencies: enhanced.dependencies,
            triggerMap: enhanced.triggerMap,
            hiddenElements: hiddenDiscovery.hiddenElements.map((element, elementIndex) =>
                this.processElement(element, 'hidden', elementIndex)
            ),
            elements: []
        };

        formsData.forEach((formData, index) => {
            const processedForm = this.processForm(formData, index);
            processed.forms.push(processedForm);
            processed.elements.push(...processedForm.elements);
            processed.metadata.totalElements += processedForm.elements.length;
        });

        // Add hidden elements to total count
        processed.metadata.totalElements += processed.hiddenElements.length;

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
            containerType: formData.containerType || 'form',
            xpath: formData.xpath,
            cssSelector: formData.cssSelector,
            elementCount: formData.elements.length,
            elements: formData.elements.map((element, elIndex) =>
                this.processElement(element, index, elIndex)
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
            ariaDescribedBy: element.ariaDescribedBy || '',
            visibility: element.visibility || {
                initiallyHidden: false,
                triggeredBy: null,
                triggerValue: null,
                triggerValueText: null,
                changeType: null
            }
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

        elements.forEach(element => {
            // Count by type
            const type = element.type || element.tagName.toLowerCase();
            stats.byType[type] = (stats.byType[type] || 0) + 1;

            // Count attributes
            if (element.required) stats.required++;
            if (element.disabled) stats.disabled++;
            if (element.id) stats.withId++;
            if (element.name) stats.withName++;
            if (element.label) stats.withLabel++;
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
        data.forms.forEach((form, formIndex) => {
            summary.push(`  ${formIndex + 1}. ${form.name} (${form.elementCount} elements)`);
        });

        if (data.dependencies.length > 0) {
            summary.push(`\nDependencies:`);
            data.dependencies.forEach((dependency, dependencyIndex) => {
                summary.push(`  ${dependencyIndex + 1}. ${dependency.source} ${dependency.type} ${dependency.target}`);
            });
        }

        return summary.join('\n');
    }

    /**
     * Filter elements by criteria
     */
    static filterElements(elements, criteria) {
        return elements.filter(element => {
            if (criteria.type && element.type !== criteria.type) return false;
            if (criteria.hasId && !element.id) return false;
            if (criteria.hasName && !element.name) return false;
            if (criteria.required !== undefined && element.required !== criteria.required) return false;
            if (criteria.disabled !== undefined && element.disabled !== criteria.disabled) return false;
            if (criteria.search) {
                const searchLower = criteria.search.toLowerCase();
                const searchable = [
                    element.id, element.name, element.label, element.placeholder, element.type
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
        elements.forEach(element => {
            const type = element.type || 'other';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(element);
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
            'ARIA Label',
            'Initially Hidden',
            'Triggered By',
            'Trigger Value',
            'Change Type'
        ];
        rows.push(headers);

        // Add data rows - one row per element
        data.elements.forEach(element => {
            // Get form name
            const form = data.forms.find(formEntry => formEntry.formIndex === element.formIndex);
            const formName = form ? form.name : 'Unknown Form';

            // Format options if present (for dropdowns)
            let optionsStr = '';
            if (element.options && element.options.length > 0) {
                optionsStr = element.options
                    .map(option => `[${option.index}] ${option.label || option.text}=${option.value}`)
                    .join('; ');
            }

            // Get dependency info
            let dependsOnStr = '';
            if (element.dropdownDependency && element.dropdownDependency.dependsOn) {
                dependsOnStr = element.dropdownDependency.dependsOn;
            }

            // Extract React selectors
            const react = element.reactSelectors || {};

            // Extract visibility info
            const visibility = element.visibility || {};

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
                element.ariaLabel || '',
                visibility.initiallyHidden ? 'Yes' : 'No',
                visibility.triggeredBy || '',
                visibility.triggerValueText || visibility.triggerValue || '',
                visibility.changeType || ''
            ];

            rows.push(row);
        });

        // Also add hidden elements as rows
        if (data.hiddenElements && data.hiddenElements.length > 0) {
            data.hiddenElements.forEach(element => {
                const react = element.reactSelectors || {};
                const visibility = element.visibility || {};
                let optionsStr = '';
                if (element.options && element.options.length > 0) {
                    optionsStr = element.options.map(option => `[${option.index}] ${option.label || option.text}=${option.value}`).join('; ');
                }
                const row = [
                    '(Hidden Element)',
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
                    '',
                    element.ariaLabel || '',
                    'Yes',
                    visibility.triggeredBy || '',
                    visibility.triggerValueText || visibility.triggerValue || '',
                    visibility.changeType || ''
                ];
                rows.push(row);
            });
        }

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
