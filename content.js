// Main Content Script - Extracts form data from the page
(function () {
    'use strict';

    // ============================
    // ELEMENT PICKER OVERLAY
    // ============================

    let pickerActive = false;
    let pickerOverlay = null;
    let pickerHighlight = null;
    let pickerTooltip = null;
    let pickerResolve = null;
    let currentHoveredElement = null;

    function startElementPicker() {
        return new Promise((resolve, reject) => {
            if (pickerActive) {
                reject(new Error('Picker already active'));
                return;
            }
            pickerActive = true;
            pickerResolve = resolve;

            // Create overlay container
            pickerOverlay = document.createElement('div');
            pickerOverlay.id = 'form-extractor-picker-overlay';
            pickerOverlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                z-index: 2147483647; cursor: crosshair;
                background: rgba(102, 126, 234, 0.05);
            `;

            // Create highlight box
            pickerHighlight = document.createElement('div');
            pickerHighlight.id = 'form-extractor-picker-highlight';
            pickerHighlight.style.cssText = `
                position: fixed; pointer-events: none; z-index: 2147483646;
                border: 2px solid #667eea; background: rgba(102, 126, 234, 0.12);
                border-radius: 3px; transition: all 0.08s ease-out;
                box-shadow: 0 0 0 2000px rgba(0,0,0,0.15);
            `;

            // Create tooltip
            pickerTooltip = document.createElement('div');
            pickerTooltip.id = 'form-extractor-picker-tooltip';
            pickerTooltip.style.cssText = `
                position: fixed; pointer-events: none; z-index: 2147483647;
                background: #1a1a2e; color: #fff; padding: 6px 12px;
                border-radius: 4px; font-family: 'Consolas', monospace;
                font-size: 12px; white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 500px; overflow: hidden; text-overflow: ellipsis;
            `;

            // Create instruction banner
            const banner = document.createElement('div');
            banner.id = 'form-extractor-picker-banner';
            banner.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; text-align: center; padding: 10px 20px;
                font-family: 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            `;
            banner.textContent = '🎯 Click on any section/container to extract its form elements  •  Press ESC to cancel';

            document.documentElement.appendChild(pickerHighlight);
            document.documentElement.appendChild(pickerTooltip);
            document.documentElement.appendChild(banner);
            document.documentElement.appendChild(pickerOverlay);

            pickerOverlay.addEventListener('mousemove', onPickerMouseMove);
            pickerOverlay.addEventListener('click', onPickerClick);
            document.addEventListener('keydown', onPickerKeyDown);
        });
    }

    function onPickerMouseMove(e) {
        // Hide overlay momentarily to get element underneath
        pickerOverlay.style.pointerEvents = 'none';
        const el = document.elementFromPoint(e.clientX, e.clientY);
        pickerOverlay.style.pointerEvents = '';

        if (!el || el.id?.startsWith('form-extractor-picker')) return;

        // Find the best container (prefer divs, sections, fieldsets, forms over individual inputs)
        let target = el;
        const containerTags = ['DIV', 'SECTION', 'FIELDSET', 'FORM', 'MAIN', 'ARTICLE', 'ASIDE', 'NAV', 'UL', 'OL', 'TABLE'];
        if (!containerTags.includes(target.tagName)) {
            // Walk up to nearest container
            let parent = target.parentElement;
            while (parent && parent !== document.body && parent !== document.documentElement) {
                if (containerTags.includes(parent.tagName)) {
                    target = parent;
                    break;
                }
                parent = parent.parentElement;
            }
        }

        currentHoveredElement = target;

        // Update highlight position
        const rect = target.getBoundingClientRect();
        pickerHighlight.style.top = rect.top + 'px';
        pickerHighlight.style.left = rect.left + 'px';
        pickerHighlight.style.width = rect.width + 'px';
        pickerHighlight.style.height = rect.height + 'px';
        pickerHighlight.style.display = 'block';

        // Update tooltip
        let tooltipText = `<${target.tagName.toLowerCase()}>`;
        if (target.id) tooltipText += `#${target.id}`;
        if (target.className && typeof target.className === 'string') {
            const classes = target.className.trim().split(/\s+/).slice(0, 3).join('.');
            if (classes) tooltipText += `.${classes}`;
        }
        // Count form elements inside
        const innerElements = target.querySelectorAll('input, select, textarea, button');
        tooltipText += `  (${innerElements.length} element${innerElements.length !== 1 ? 's' : ''})`;
        pickerTooltip.textContent = tooltipText;

        // Position tooltip above or below the element
        const tooltipY = rect.top > 50 ? rect.top - 35 : rect.bottom + 8;
        pickerTooltip.style.top = tooltipY + 'px';
        pickerTooltip.style.left = Math.min(rect.left, window.innerWidth - 400) + 'px';
        pickerTooltip.style.display = 'block';
    }

    function onPickerClick(e) {
        e.preventDefault();
        e.stopPropagation();

        if (!currentHoveredElement) return;

        const target = currentHoveredElement;
        const selector = generateUniqueSelector(target);

        stopElementPicker();

        if (pickerResolve) {
            pickerResolve({
                selector: selector,
                tagName: target.tagName.toLowerCase(),
                id: target.id || '',
                className: (typeof target.className === 'string' ? target.className : '').trim(),
                elementCount: target.querySelectorAll('input, select, textarea, button').length
            });
            pickerResolve = null;
        }
    }

    function onPickerKeyDown(e) {
        if (e.key === 'Escape') {
            stopElementPicker();
            if (pickerResolve) {
                pickerResolve(null); // cancelled
                pickerResolve = null;
            }
        }
    }

    function stopElementPicker() {
        pickerActive = false;
        currentHoveredElement = null;

        ['form-extractor-picker-overlay', 'form-extractor-picker-highlight',
         'form-extractor-picker-tooltip', 'form-extractor-picker-banner'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        document.removeEventListener('keydown', onPickerKeyDown);
        pickerOverlay = null;
        pickerHighlight = null;
        pickerTooltip = null;
    }

    // Generate a unique CSS selector for any element
    function generateUniqueSelector(element) {
        if (element.id) return `#${element.id}`;

        const path = [];
        let current = element;
        while (current && current !== document.body && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                path.unshift(`#${current.id}`);
                break;
            }
            const siblings = Array.from(current.parentElement?.children || []).filter(
                el => el.tagName === current.tagName
            );
            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-of-type(${index})`;
            }
            path.unshift(selector);
            current = current.parentElement;
        }
        if (path[0] && !path[0].startsWith('#')) {
            path.unshift('body');
        }
        return path.join(' > ');
    }

    // ============================
    // HIDDEN ELEMENT DISCOVERY
    // ============================

    async function discoverHiddenElements(container) {
        console.log('Form Extractor: Discovering hidden elements...');
        const discoveries = [];
        const processedTriggers = new Set();

        // Snapshot currently visible/enabled elements
        const initialSnapshot = snapshotElementStates(container);

        // Collect all triggers: <select> elements and radio groups
        const selects = Array.from(container.querySelectorAll('select'));
        const radioGroups = getRadioGroups(container);

        // Discover via <select> cycling
        for (const select of selects) {
            if (select.disabled) continue;
            const triggerId = getElementIdentifier(select);
            if (processedTriggers.has(triggerId)) continue;
            processedTriggers.add(triggerId);

            const originalValue = select.value;
            const options = Array.from(select.options);

            for (const option of options) {
                if (option.value === '' || option.value === originalValue) continue;

                // Set value and dispatch events
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                select.dispatchEvent(new Event('input', { bubbles: true }));

                // Wait for DOM updates
                await waitForDOMSettle(350);

                // Compare states
                const newSnapshot = snapshotElementStates(container);
                const changes = diffSnapshots(initialSnapshot, newSnapshot, container);

                if (changes.length > 0) {
                    discoveries.push({
                        trigger: triggerId,
                        triggerType: 'select',
                        triggerTagName: 'select',
                        triggerLabel: findLabel(select),
                        value: option.value,
                        valueText: option.textContent.trim(),
                        changes: changes
                    });
                }
            }

            // Reset to original
            select.value = originalValue;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            await waitForDOMSettle(200);
        }

        // Discover via radio button cycling
        for (const group of radioGroups) {
            const triggerId = `[name="${group.name}"]`;
            if (processedTriggers.has(triggerId)) continue;
            processedTriggers.add(triggerId);

            const originalChecked = group.radios.find(r => r.checked);

            for (const radio of group.radios) {
                if (radio === originalChecked) continue;

                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                radio.dispatchEvent(new Event('input', { bubbles: true }));

                await waitForDOMSettle(350);

                const newSnapshot = snapshotElementStates(container);
                const changes = diffSnapshots(initialSnapshot, newSnapshot, container);

                if (changes.length > 0) {
                    discoveries.push({
                        trigger: triggerId,
                        triggerType: 'radio',
                        triggerTagName: 'input[type="radio"]',
                        triggerLabel: group.name,
                        value: radio.value,
                        valueText: findLabel(radio) || radio.value,
                        changes: changes
                    });
                }
            }

            // Reset to original
            if (originalChecked) {
                originalChecked.checked = true;
                originalChecked.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                group.radios.forEach(r => r.checked = false);
            }
            await waitForDOMSettle(200);
        }

        // Also discover via checkbox toggling
        const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
        for (const cb of checkboxes) {
            const triggerId = getElementIdentifier(cb);
            if (processedTriggers.has(triggerId)) continue;
            processedTriggers.add(triggerId);

            const originalState = cb.checked;
            cb.checked = !originalState;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            await waitForDOMSettle(350);

            const newSnapshot = snapshotElementStates(container);
            const changes = diffSnapshots(initialSnapshot, newSnapshot, container);
            if (changes.length > 0) {
                discoveries.push({
                    trigger: triggerId,
                    triggerType: 'checkbox',
                    triggerTagName: 'input[type="checkbox"]',
                    triggerLabel: findLabel(cb),
                    value: String(!originalState),
                    valueText: !originalState ? 'checked' : 'unchecked',
                    changes: changes
                });
            }

            // Reset
            cb.checked = originalState;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
            await waitForDOMSettle(200);
        }

        // Now extract full data for every hidden element discovered
        const hiddenElements = [];
        const hiddenSelectors = new Set();

        for (const disc of discoveries) {
            for (const change of disc.changes) {
                if (!hiddenSelectors.has(change.targetSelector)) {
                    hiddenSelectors.add(change.targetSelector);

                    // Re-trigger to make element visible/enabled for extraction
                    await activateTrigger(container, disc);
                    await waitForDOMSettle(350);

                    const targetEl = container.querySelector(change.targetSelector) ||
                                     document.querySelector(change.targetSelector);
                    if (targetEl) {
                        // Extract the element or all elements inside a container
                        const extractedFromHidden = await extractElementsFromTarget(targetEl);
                        for (const elData of extractedFromHidden) {
                            elData.visibility = {
                                initiallyHidden: true,
                                triggeredBy: disc.trigger,
                                triggerValue: disc.value,
                                triggerValueText: disc.valueText,
                                changeType: change.changeType
                            };
                            hiddenElements.push(elData);
                        }
                    }

                    // Reset trigger
                    await resetTrigger(container, disc);
                    await waitForDOMSettle(200);
                }
            }
        }

        console.log(`Form Extractor: Discovered ${hiddenElements.length} hidden elements via ${discoveries.length} trigger-value combinations`);
        return { discoveries, hiddenElements };
    }

    // Snapshot all element visibility/disabled states in a container
    function snapshotElementStates(container) {
        const snapshot = new Map();
        const allElements = container.querySelectorAll('input, select, textarea, button, fieldset, [class*="conditional"], [data-show-when], [style*="display"]');

        // Also check all divs/sections that may toggle visibility
        const containers = container.querySelectorAll('div, section, fieldset, span, p, label');
        const allNodes = [...allElements, ...containers];

        allNodes.forEach(el => {
            const sel = getElementIdentifier(el);
            snapshot.set(sel, {
                visible: isElementVisible(el),
                disabled: el.disabled || false,
                display: window.getComputedStyle(el).display,
                opacity: window.getComputedStyle(el).opacity,
                classList: el.className ? String(el.className) : ''
            });
        });

        return snapshot;
    }

    function isElementVisible(el) {
        if (el.hidden) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (style.opacity === '0') return false;
        // Check parent visibility
        const parent = el.offsetParent;
        if (!parent && el.tagName !== 'BODY' && el.tagName !== 'HTML' && style.position !== 'fixed') {
            return false;
        }
        return true;
    }

    function diffSnapshots(before, after, container) {
        const changes = [];

        after.forEach((afterState, selector) => {
            const beforeState = before.get(selector);
            if (!beforeState) return; // new element—skip for now

            // Became visible
            if (!beforeState.visible && afterState.visible) {
                changes.push({
                    targetSelector: selector,
                    changeType: 'visible',
                    description: `Element became visible`
                });
            }
            // Became enabled
            if (beforeState.disabled && !afterState.disabled) {
                changes.push({
                    targetSelector: selector,
                    changeType: 'enabled',
                    description: `Element became enabled`
                });
            }
            // CSS class changed (e.g., .show added)
            if (beforeState.classList !== afterState.classList) {
                if (beforeState.display === 'none' && afterState.display !== 'none') {
                    changes.push({
                        targetSelector: selector,
                        changeType: 'visible',
                        description: `Element display changed from none`
                    });
                }
            }
        });

        // Check for new elements that appeared in DOM
        const afterAllElements = container.querySelectorAll('input, select, textarea, button');
        afterAllElements.forEach(el => {
            const sel = getElementIdentifier(el);
            if (!before.has(sel) && isElementVisible(el)) {
                changes.push({
                    targetSelector: sel,
                    changeType: 'new',
                    description: `New element appeared in DOM`
                });
            }
        });

        return changes;
    }

    function getRadioGroups(container) {
        const groups = {};
        container.querySelectorAll('input[type="radio"]').forEach(radio => {
            if (!radio.name) return;
            if (!groups[radio.name]) {
                groups[radio.name] = { name: radio.name, radios: [] };
            }
            groups[radio.name].radios.push(radio);
        });
        return Object.values(groups);
    }

    function getElementIdentifier(el) {
        if (el.id) return `#${el.id}`;
        if (el.name && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
            return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
        }
        return generateUniqueSelector(el);
    }

    async function activateTrigger(container, discovery) {
        if (discovery.triggerType === 'select') {
            const el = container.querySelector(discovery.trigger) || document.querySelector(discovery.trigger);
            if (el) {
                el.value = discovery.value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (discovery.triggerType === 'radio') {
            const radios = container.querySelectorAll(discovery.trigger);
            radios.forEach(r => {
                if (r.value === discovery.value) {
                    r.checked = true;
                    r.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        } else if (discovery.triggerType === 'checkbox') {
            const el = container.querySelector(discovery.trigger) || document.querySelector(discovery.trigger);
            if (el) {
                el.checked = discovery.value === 'true';
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    async function resetTrigger(container, discovery) {
        if (discovery.triggerType === 'select') {
            const el = container.querySelector(discovery.trigger) || document.querySelector(discovery.trigger);
            if (el && el.options[0]) {
                el.value = el.options[0].value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (discovery.triggerType === 'radio') {
            // Reset to first radio
            const radios = container.querySelectorAll(discovery.trigger);
            if (radios[0]) {
                radios[0].checked = true;
                radios[0].dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (discovery.triggerType === 'checkbox') {
            const el = container.querySelector(discovery.trigger) || document.querySelector(discovery.trigger);
            if (el) {
                el.checked = discovery.value !== 'true';
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    // Extract form elements from a target (could be a single element or a container)
    async function extractElementsFromTarget(target) {
        const results = [];
        const tagName = target.tagName.toUpperCase();

        if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tagName)) {
            results.push(await extractElementData(target, 0));
        } else {
            // It's a container — extract all form elements inside
            const children = target.querySelectorAll('input, select, textarea, button[type="submit"], button[type="button"]');
            for (let i = 0; i < children.length; i++) {
                results.push(await extractElementData(children[i], i));
            }
        }
        return results;
    }

    function waitForDOMSettle(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================
    // MAIN EXTRACTION
    // ============================

    // Main extraction function — now supports scoped container
    async function extractFormData(scopeSelector) {
        console.log('Form Extractor: Starting extraction...', scopeSelector ? `Scope: ${scopeSelector}` : 'Full page');

        const formsData = [];
        let container = document;

        // If a scope selector is provided, extract from that specific container
        if (scopeSelector) {
            const scopeEl = document.querySelector(scopeSelector);
            if (!scopeEl) {
                throw new Error(`Scoped container not found: ${scopeSelector}`);
            }
            container = scopeEl;

            const formData = await extractFormElements(scopeEl, {
                id: scopeEl.id || 'scoped-section',
                name: scopeEl.id || scopeEl.className?.split?.(' ')?.[0] || 'Selected Section',
                action: '',
                method: '',
                containerType: 'section'
            });
            formsData.push(formData);
        } else {
            // Original behavior: find <form> tags or standalone elements
            const forms = document.querySelectorAll('form');

            if (forms.length === 0) {
                const standaloneElements = document.querySelectorAll('input, select, textarea, button');
                if (standaloneElements.length > 0) {
                    const standaloneFormData = await extractFormElements(document.body, {
                        id: 'standalone',
                        name: 'Standalone Elements',
                        action: '',
                        method: '',
                        containerType: 'standalone'
                    });
                    formsData.push(standaloneFormData);
                }
                container = document.body;
            } else {
                for (let index = 0; index < forms.length; index++) {
                    const form = forms[index];
                    const formData = await extractFormElements(form, {
                        id: form.id || `form_${index}`,
                        name: form.name || form.id || `Form ${index + 1}`,
                        action: form.action || '',
                        method: form.method || 'GET',
                        containerType: 'form'
                    });
                    formsData.push(formData);
                }

                // ALSO extract standalone elements outside forms
                const allFormElements = new Set();
                forms.forEach(f => f.querySelectorAll('input, select, textarea, button').forEach(el => allFormElements.add(el)));
                const standaloneEls = Array.from(document.querySelectorAll('input, select, textarea, button'))
                    .filter(el => !allFormElements.has(el));
                if (standaloneEls.length > 0) {
                    const wrapperDiv = document.createElement('div');
                    standaloneEls.forEach(el => wrapperDiv.appendChild(el.cloneNode(true)));
                    const standaloneFormData = await extractFormElements(document.body, {
                        id: 'standalone',
                        name: 'Standalone Elements (Outside Forms)',
                        action: '',
                        method: '',
                        containerType: 'standalone'
                    });
                    // Re-extract properly from body filtering already-processed
                    standaloneFormData.elements = [];
                    for (const el of standaloneEls) {
                        standaloneFormData.elements.push(await extractElementData(el, standaloneFormData.elements.length));
                    }
                    if (standaloneFormData.elements.length > 0) {
                        formsData.push(standaloneFormData);
                    }
                }

                container = document.body;
            }
        }

        // Detect dependencies (static analysis)
        const detector = new DependencyDetector();
        const formContainers = scopeSelector
            ? [document.querySelector(scopeSelector)]
            : (document.querySelectorAll('form').length > 0 ? Array.from(document.querySelectorAll('form')) : [document.body]);
        const dependencies = detector.analyzeForms(formContainers);

        // Discover hidden elements via trigger cycling
        const scopeContainer = scopeSelector ? document.querySelector(scopeSelector) : document.body;
        let hiddenDiscovery = { discoveries: [], hiddenElements: [] };
        try {
            hiddenDiscovery = await discoverHiddenElements(scopeContainer);
        } catch (err) {
            console.warn('Form Extractor: Hidden discovery error:', err);
        }

        // Process all data
        const processedData = DataProcessor.process(formsData, dependencies, hiddenDiscovery);

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
        if (request.action === 'ping') {
            sendResponse({ success: true, version: 'v2' });
            return false;
        }

        if (request.action === 'extractForms') {
            extractFormData(request.scope || null).then(data => {
                sendResponse({ success: true, data: data });
            }).catch(error => {
                console.error('Form Extractor Error:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true;
        }

        if (request.action === 'pickElement') {
            // Start picker and respond immediately — result goes to background service worker
            // (because the popup will close when user clicks on the page)
            startElementPicker().then(result => {
                if (result) {
                    chrome.runtime.sendMessage({ action: 'pickerResult', data: result });
                } else {
                    chrome.runtime.sendMessage({ action: 'pickerCancelled' });
                }
            }).catch(error => {
                console.error('Form Extractor Picker Error:', error);
            });
            sendResponse({ success: true, pickerStarted: true });
            return false;
        }

        if (request.action === 'cancelPicker') {
            stopElementPicker();
            sendResponse({ success: true });
            return false;
        }

        if (request.action === 'discoverHidden') {
            const scope = request.scope ? document.querySelector(request.scope) : document.body;
            if (!scope) {
                sendResponse({ success: false, error: 'Scope container not found' });
                return false;
            }
            discoverHiddenElements(scope).then(result => {
                sendResponse({ success: true, data: result });
            }).catch(error => {
                console.error('Form Extractor Discovery Error:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true;
        }
    });

    console.log('Form Extractor: Content script loaded (v2 with picker + hidden discovery)');
})();
