// Dependency Detector - Analyzes field relationships and conditional logic
class DependencyDetector {
    constructor() {
        this.dependencies = [];
        this.observedElements = new Set();
    }

    /**
     * Analyze all forms and detect dependencies
     */
    analyzeForms(forms) {
        this.dependencies = [];

        forms.forEach(form => {
            this.analyzeForm(form);
        });

        return this.dependencies;
    }

    /**
     * Analyze a single form for dependencies
     */
    analyzeForm(form) {
        const formElements = form.querySelectorAll('input, select, textarea, button');

        formElements.forEach(element => {
            // Check for event listeners that might control other elements
            this.detectEventBasedDependencies(element, form);

            // Check for data attributes that indicate dependencies
            this.detectDataAttributeDependencies(element);

            // Check for conditional visibility patterns
            this.detectVisibilityDependencies(element, form);
        });
    }

    /**
     * Detect dependencies based on common event patterns
     */
    detectEventBasedDependencies(element, form) {
        // Detect common patterns:
        // 1. onChange/onInput handlers
        // 2. Elements that show/hide other elements
        // 3. Elements that enable/disable other elements

        const elementId = this.getElementIdentifier(element);

        // Check for data-* attributes that indicate control
        const controls = element.getAttribute('data-controls');
        const enables = element.getAttribute('data-enables');
        const shows = element.getAttribute('data-shows');

        if (controls) {
            this.addDependency(elementId, controls, 'controls');
        }

        if (enables) {
            this.addDependency(elementId, enables, 'enables');
        }

        if (shows) {
            this.addDependency(elementId, shows, 'shows');
        }

        // Detect checkbox/radio that enables/disables others
        if (element.type === 'checkbox' || element.type === 'radio') {
            this.detectToggleDependencies(element, form);
        }

        // Detect select dropdowns that control visibility
        if (element.tagName === 'SELECT') {
            this.detectSelectDependencies(element, form);
        }
    }

    /**
     * Detect toggle-based dependencies (checkboxes/radios)
     */
    detectToggleDependencies(element, form) {
        const elementId = this.getElementIdentifier(element);

        // Look for nearby elements that might be controlled
        // Common pattern: checkbox followed by a fieldset or div
        let nextElement = element.parentElement?.nextElementSibling;

        while (nextElement) {
            if (nextElement.tagName === 'FIELDSET' ||
                nextElement.classList.contains('conditional') ||
                nextElement.hasAttribute('data-conditional')) {

                const targetId = this.getElementIdentifier(nextElement);
                this.addDependency(elementId, targetId, 'toggles', {
                    initialState: nextElement.disabled || nextElement.style.display === 'none'
                });
                break;
            }
            nextElement = nextElement.nextElementSibling;
        }

        // Check if element is disabled - might indicate dependency
        const formElements = form.querySelectorAll('[disabled]');
        formElements.forEach(disabled => {
            // Check if they share a common name pattern or data attribute
            const elementName = element.name || element.id || '';
            const disabledName = disabled.name || disabled.id || '';

            if (elementName && disabledName &&
                disabledName.includes(elementName) &&
                element !== disabled) {
                const disabledId = this.getElementIdentifier(disabled);
                this.addDependency(elementId, disabledId, 'enables');
            }
        });
    }

    /**
     * Detect select dropdown dependencies
     */
    detectSelectDependencies(element, form) {
        const elementId = this.getElementIdentifier(element);
        const formElements = Array.from(form.querySelectorAll('input, select, textarea'));

        // Look for elements that appear after this select
        const elementIndex = formElements.indexOf(element);
        const subsequentElements = formElements.slice(elementIndex + 1);

        // Check if subsequent elements have data attributes or are in conditional containers
        subsequentElements.forEach(target => {
            const container = target.closest('[data-show-when], [data-conditional]');
            if (container) {
                const condition = container.getAttribute('data-show-when');
                const targetId = this.getElementIdentifier(target);

                this.addDependency(elementId, targetId, 'shows', {
                    condition: condition || 'value-dependent'
                });
            }
        });
    }

    /**
     * Detect dependencies based on data attributes
     */
    detectDataAttributeDependencies(element) {
        const elementId = this.getElementIdentifier(element);

        // Check for common data attribute patterns
        const dependsOn = element.getAttribute('data-depends-on');
        const requiredIf = element.getAttribute('data-required-if');
        const showIf = element.getAttribute('data-show-if');

        if (dependsOn) {
            this.addDependency(dependsOn, elementId, 'controls');
        }

        if (requiredIf) {
            this.addDependency(requiredIf, elementId, 'requires');
        }

        if (showIf) {
            this.addDependency(showIf, elementId, 'shows');
        }
    }

    /**
     * Detect visibility-based dependencies
     */
    detectVisibilityDependencies(element, form) {
        // Check if element is initially hidden
        const isHidden = element.style.display === 'none' ||
            element.hidden ||
            element.closest('[style*="display: none"]') ||
            element.closest('[hidden]');

        if (isHidden) {
            const elementId = this.getElementIdentifier(element);

            // Look for potential controlling elements
            const potentialControllers = form.querySelectorAll('input[type="checkbox"], input[type="radio"], select');

            potentialControllers.forEach(controller => {
                // Check if controller name/id is related to hidden element
                const controllerId = this.getElementIdentifier(controller);
                const elementName = element.name || element.id || '';
                const controllerName = controller.name || controller.id || '';

                // Simple heuristic: if names share common prefix
                if (elementName && controllerName) {
                    const commonPrefix = this.getCommonPrefix(elementName, controllerName);
                    if (commonPrefix.length > 3) {
                        this.addDependency(controllerId, elementId, 'conditionally-shows');
                    }
                }
            });
        }
    }

    /**
     * Add a dependency relationship
     */
    addDependency(sourceId, targetId, type, metadata = {}) {
        // Avoid duplicates
        const exists = this.dependencies.some(dep =>
            dep.source === sourceId &&
            dep.target === targetId &&
            dep.type === type
        );

        if (!exists && sourceId && targetId) {
            this.dependencies.push({
                source: sourceId,
                target: targetId,
                type: type,
                ...metadata
            });
        }
    }

    /**
     * Get a stable identifier for an element
     */
    getElementIdentifier(element) {
        if (element.id) return `#${element.id}`;
        if (element.name) return `[name="${element.name}"]`;
        if (element.tagName === 'FIELDSET' && element.querySelector('legend')) {
            const legend = element.querySelector('legend').textContent.trim();
            return `fieldset:${legend}`;
        }

        // Fallback to XPath
        if (typeof XPathGenerator !== 'undefined') {
            return XPathGenerator.generate(element);
        }

        return element.tagName.toLowerCase();
    }

    /**
     * Get common prefix between two strings
     */
    getCommonPrefix(str1, str2) {
        let i = 0;
        while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
            i++;
        }
        return str1.substring(0, i);
    }

    /**
     * Get all detected dependencies
     */
    getDependencies() {
        return this.dependencies;
    }

    /**
     * Enhance static dependencies with dynamic discovery data
     * Merges trigger-value mappings from hidden element discovery into the dependency list
     */
    static enhanceWithDiscovery(staticDeps, discoveries) {
        const enhanced = [...staticDeps];
        const existingPairs = new Set(staticDeps.map(d => `${d.source}|${d.target}`));

        // Group discoveries by trigger
        const triggerMap = {};
        for (const disc of discoveries) {
            if (!triggerMap[disc.trigger]) {
                triggerMap[disc.trigger] = {
                    source: disc.trigger,
                    triggerType: disc.triggerType,
                    triggerLabel: disc.triggerLabel,
                    type: 'controls',
                    triggerValues: []
                };
            }

            const revealedElements = disc.changes.map(c => c.targetSelector);
            triggerMap[disc.trigger].triggerValues.push({
                value: disc.value,
                valueText: disc.valueText,
                revealsElements: revealedElements,
                changeTypes: disc.changes.map(c => c.changeType)
            });

            // Also add individual source->target dependencies
            for (const change of disc.changes) {
                const pairKey = `${disc.trigger}|${change.targetSelector}`;
                if (!existingPairs.has(pairKey)) {
                    existingPairs.add(pairKey);
                    enhanced.push({
                        source: disc.trigger,
                        target: change.targetSelector,
                        type: change.changeType === 'enabled' ? 'enables' : 'shows',
                        condition: `${disc.triggerType} = "${disc.valueText}"`,
                        discoveredDynamically: true,
                        triggerValue: disc.value,
                        triggerValueText: disc.valueText
                    });
                }
            }
        }

        return {
            dependencies: enhanced,
            triggerMap: Object.values(triggerMap)
        };
    }
}

// Make available globally
window.DependencyDetector = DependencyDetector;
