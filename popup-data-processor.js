// Data Processor Module for Popup
// This is a lightweight version for the popup context
const DataProcessorPopup = {
    /**
     * Export data to CSV format
     */
    exportToCSV(data) {
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
    },

    /**
     * Convert 2D array to CSV string
     */
    convertArrayToCSV(data) {
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
};
