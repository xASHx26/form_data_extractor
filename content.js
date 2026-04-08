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

        // If the container has 0 form elements inside, keep walking up to find one that does
        if (target.querySelectorAll('input, select, textarea, button').length === 0) {
            let ancestor = target.parentElement;
            while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
                if (containerTags.includes(ancestor.tagName) &&
                    ancestor.querySelectorAll('input, select, textarea, button').length > 0) {
                    target = ancestor;
                    break;
                }
                ancestor = ancestor.parentElement;
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

        // Fire change event via page-world script injection (for jQuery/Angular/Vue)
        function firePageEvent(target, eventName) {
            const marker = '__fe_disc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            target.setAttribute('data-fe-marker', marker);
            target.dispatchEvent(new Event(eventName || 'change', { bubbles: true }));
            target.dispatchEvent(new Event('input', { bubbles: true }));
            const script = document.createElement('script');
            script.textContent = `(function(){
                var el = document.querySelector('[data-fe-marker="${marker}"]');
                if (!el) return;
                el.removeAttribute('data-fe-marker');
                if (window.jQuery) { window.jQuery(el).trigger('${eventName || 'change'}'); }
                else if (window.$) { try { window.$(el).trigger('${eventName || 'change'}'); } catch(e){} }
                if (window.angular) {
                    var s = window.angular.element(el).scope();
                    if (s) { try { s.$apply(); } catch(e){} }
                }
            })();`;
            document.documentElement.appendChild(script);
            script.remove();
        }

        // Returns true if el is a real form field, not a table action button (which are false positives)
        function isRealFormField(el) {
            if (el.tagName === 'BUTTON') {
                // Buttons inside table cells are action buttons (Edit/Delete/Cancel), not conditional fields
                if (el.closest('td, th')) return false;
                // Buttons styled as danger/warning/info/secondary are action buttons
                const cls = el.className || '';
                if (/btn-(danger|warning|info|secondary|outline|link|dark)/.test(cls)) return false;
            }
            return true;
        }

        // Snapshot form element IDs in the DOM (to detect AJAX-injected elements)
        function snapshotFormElements(root) {
            const set = new Set();
            root.querySelectorAll('input, select, textarea, button').forEach(el => {
                if (isRealFormField(el)) set.add(getElementIdentifier(el));
            });
            // Also snapshot from document in case AJAX injects outside the container
            document.querySelectorAll('input, select, textarea, button').forEach(el => {
                if (isRealFormField(el)) set.add(getElementIdentifier(el));
            });
            return set;
        }

        // Snapshot visibility states
        const initialSnapshot = snapshotElementStates(container);
        const initialFormEls = snapshotFormElements(container);

        // Diff: check visibility changes AND newly created DOM elements
        function fullDiff(beforeSnapshot, beforeFormEls, root) {
            const changes = [];
            const afterSnapshot = snapshotElementStates(root);

            // Visibility/enabled changes
            afterSnapshot.forEach((afterState, selector) => {
                const beforeState = beforeSnapshot.get(selector);
                if (!beforeState) return;
                if (!beforeState.visible && afterState.visible) {
                    changes.push({ targetSelector: selector, changeType: 'visible', description: 'Became visible' });
                }
                if (beforeState.disabled && !afterState.disabled) {
                    changes.push({ targetSelector: selector, changeType: 'enabled', description: 'Became enabled' });
                }
                if (beforeState.classList !== afterState.classList && beforeState.display === 'none' && afterState.display !== 'none') {
                    changes.push({ targetSelector: selector, changeType: 'visible', description: 'Display changed from none' });
                }
            });

            // Newly created form elements (AJAX-injected)
            const afterFormEls = snapshotFormElements(root);
            afterFormEls.forEach(sel => {
                if (!beforeFormEls.has(sel)) {
                    const el = root.querySelector(sel) || document.querySelector(sel);
                    if (el && isElementVisible(el) && isRealFormField(el)) {
                        changes.push({ targetSelector: sel, changeType: 'new', description: 'New element appeared in DOM' });
                    }
                }
            });

            return changes;
        }

        // ---- DISCOVER VIA SELECT CYCLING ----
        const selects = Array.from(container.querySelectorAll('select'));
        for (const select of selects) {
            if (select.disabled) continue;
            const triggerId = getElementIdentifier(select);
            if (processedTriggers.has(triggerId)) continue;
            processedTriggers.add(triggerId);

            const originalIndex = select.selectedIndex;
            const originalValue = select.value;
            const options = Array.from(select.options);
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;

            for (const option of options) {
                if (option.value === '' || option.value === originalValue || option.disabled) continue;

                select.selectedIndex = option.index;
                if (nativeSetter) nativeSetter.call(select, option.value);
                select.focus();
                firePageEvent(select, 'change');
                select.blur();

                await waitForDOMSettle(500);

                const changes = fullDiff(initialSnapshot, initialFormEls, container);
                if (changes.length > 0) {
                    discoveries.push({
                        trigger: triggerId, triggerType: 'select', triggerTagName: 'select',
                        triggerLabel: findLabel(select), value: option.value,
                        valueText: option.textContent.trim(), changes: changes
                    });
                }
            }

            // Reset
            select.selectedIndex = originalIndex;
            if (nativeSetter) nativeSetter.call(select, originalValue);
            else select.value = originalValue;
            firePageEvent(select, 'change');
            await waitForDOMSettle(300);
        }

        // ---- DISCOVER VIA RADIO CYCLING ----
        // Re-snapshot AFTER select cycling completes so we have a clean baseline
        // (select cycling resets each select, but residual DOM changes can pollute initialSnapshot)
        const radioBaseSnapshot = snapshotElementStates(container);
        const radioBaseFormEls = snapshotFormElements(container);

        const radioGroups = getRadioGroups(container);
        for (const group of radioGroups) {
            const triggerId = `input[name="${group.name}"]`;
            if (processedTriggers.has(triggerId)) continue;
            processedTriggers.add(triggerId);

            const originalChecked = group.radios.find(r => r.checked);

            // Try EVERY radio option (not just the unchecked ones).
            // E.g. "More than 1 day" may already be the default but we still need to
            // test the OTHER options first so we can detect what EACH one reveals.
            for (const radio of group.radios) {
                if (radio.disabled) continue;

                // Take a fresh "before" snapshot each time before clicking a new radio
                const beforeRadio = snapshotElementStates(container);
                const beforeRadioFormEls = snapshotFormElements(container);

                radio.click();
                firePageEvent(radio, 'change');
                await waitForDOMSettle(600);

                const changes = fullDiff(beforeRadio, beforeRadioFormEls, container);
                if (changes.length > 0) {
                    discoveries.push({
                        trigger: triggerId, triggerType: 'radio', triggerTagName: 'input[type="radio"]',
                        triggerLabel: group.name, value: radio.value,
                        valueText: findLabel(radio) || radio.value, changes: changes
                    });
                }
            }

            // Reset to original
            if (originalChecked) {
                originalChecked.click();
                firePageEvent(originalChecked, 'change');
            } else {
                group.radios.forEach(r => { r.checked = false; });
            }
            await waitForDOMSettle(400);
        }

        // ---- DISCOVER VIA CHECKBOX TOGGLING ----
        const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
        for (const cb of checkboxes) {
            if (cb.disabled) continue;
            const triggerId = getElementIdentifier(cb);
            if (processedTriggers.has(triggerId)) continue;
            processedTriggers.add(triggerId);

            // Fresh snapshot before each checkbox toggle for clean baseline
            const beforeCb = snapshotElementStates(container);
            const beforeCbFormEls = snapshotFormElements(container);

            cb.click();
            firePageEvent(cb, 'change');
            await waitForDOMSettle(500);

            const changes = fullDiff(beforeCb, beforeCbFormEls, container);
            if (changes.length > 0) {
                discoveries.push({
                    trigger: triggerId, triggerType: 'checkbox', triggerTagName: 'input[type="checkbox"]',
                    triggerLabel: findLabel(cb), value: String(cb.checked),
                    valueText: cb.checked ? 'checked' : 'unchecked', changes: changes
                });
            }

            // Reset — click again to toggle back
            cb.click();
            firePageEvent(cb, 'change');
            await waitForDOMSettle(300);
        }

        // ---- DISCOVER VIA TABS / ACCORDIONS / TOGGLE BUTTONS ----
        const toggleSelectors = [
            '[role="tab"]', '[data-toggle]', '[data-bs-toggle]',
            '.accordion-button', '.accordion-header', '.collapse-toggle',
            '.tab-link', '.nav-tab', '.nav-link',
            'button[aria-expanded]', '[aria-controls]',
            '.panel-heading', '.card-header button'
        ];
        const toggleEls = Array.from(container.querySelectorAll(toggleSelectors.join(', ')));
        for (const toggle of toggleEls) {
            const triggerId = getElementIdentifier(toggle);
            if (processedTriggers.has(triggerId)) continue;
            processedTriggers.add(triggerId);

            toggle.click();
            await waitForDOMSettle(500);

            const changes = fullDiff(initialSnapshot, initialFormEls, container);
            if (changes.length > 0) {
                discoveries.push({
                    trigger: triggerId, triggerType: 'toggle', triggerTagName: toggle.tagName.toLowerCase(),
                    triggerLabel: toggle.textContent.trim().slice(0, 50),
                    value: 'clicked', valueText: 'clicked', changes: changes
                });
            }
            // Don't reset toggles — they may be needed for extraction
        }

        // ---- EXTRACT ALL DISCOVERED HIDDEN ELEMENTS ----
        const hiddenElements = [];
        const hiddenSelectors = new Set();

        for (const disc of discoveries) {
            for (const change of disc.changes) {
                if (hiddenSelectors.has(change.targetSelector)) continue;
                hiddenSelectors.add(change.targetSelector);

                // Re-trigger to make element visible/enabled
                await activateTrigger(container, disc);
                await waitForDOMSettle(500);

                // Try to find in container first, then document (AJAX may inject anywhere)
                let targetEl = null;
                try { targetEl = container.querySelector(change.targetSelector); } catch(e) {}
                if (!targetEl) {
                    try { targetEl = document.querySelector(change.targetSelector); } catch(e) {}
                }

                if (targetEl) {
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
                await waitForDOMSettle(300);
            }
        }

        console.log(`Form Extractor: Discovered ${hiddenElements.length} hidden elements via ${discoveries.length} trigger-value combinations`);
        return { discoveries, hiddenElements };
    }

    // Snapshot all element visibility/disabled states
    function snapshotElementStates(container) {
        const snapshot = new Map();
        const allElements = container.querySelectorAll('input, select, textarea, button, fieldset, [class*="conditional"], [data-show-when], [style*="display"]');
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
        const parent = el.offsetParent;
        if (!parent && el.tagName !== 'BODY' && el.tagName !== 'HTML' && style.position !== 'fixed') {
            return false;
        }
        return true;
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
                el.selectedIndex = Array.from(el.options).findIndex(o => o.value === discovery.value);
                const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
                if (nativeSetter) nativeSetter.call(el, discovery.value);
                else el.value = discovery.value;
                el.focus();
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('input', { bubbles: true }));
                // Page-world jQuery trigger
                const marker = '__fe_act_' + Date.now();
                el.setAttribute('data-fe-marker', marker);
                const script = document.createElement('script');
                script.textContent = `(function(){var el=document.querySelector('[data-fe-marker="${marker}"]');if(!el)return;el.removeAttribute('data-fe-marker');if(window.jQuery)window.jQuery(el).trigger('change');else if(window.$)try{window.$(el).trigger('change')}catch(e){}})();`;
                document.documentElement.appendChild(script);
                script.remove();
            }
        } else if (discovery.triggerType === 'radio') {
            const radios = container.querySelectorAll(discovery.trigger) || document.querySelectorAll(discovery.trigger);
            radios.forEach(r => {
                if (r.value === discovery.value) {
                    r.click();
                    r.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        } else if (discovery.triggerType === 'checkbox') {
            const el = container.querySelector(discovery.trigger) || document.querySelector(discovery.trigger);
            if (el) {
                const wantChecked = discovery.value === 'true';
                if (el.checked !== wantChecked) el.click();
            }
        } else if (discovery.triggerType === 'toggle') {
            const el = container.querySelector(discovery.trigger) || document.querySelector(discovery.trigger);
            if (el) el.click();
        }
    }

    async function resetTrigger(container, discovery) {
        if (discovery.triggerType === 'select') {
            const el = container.querySelector(discovery.trigger) || document.querySelector(discovery.trigger);
            if (el && el.options[0]) {
                el.selectedIndex = 0;
                el.value = el.options[0].value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
                const marker = '__fe_rst_' + Date.now();
                el.setAttribute('data-fe-marker', marker);
                const script = document.createElement('script');
                script.textContent = `(function(){var el=document.querySelector('[data-fe-marker="${marker}"]');if(!el)return;el.removeAttribute('data-fe-marker');if(window.jQuery)window.jQuery(el).trigger('change');else if(window.$)try{window.$(el).trigger('change')}catch(e){}})();`;
                document.documentElement.appendChild(script);
                script.remove();
            }
        } else if (discovery.triggerType === 'radio') {
            const radios = container.querySelectorAll(discovery.trigger);
            if (radios[0]) {
                radios[0].click();
                radios[0].dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (discovery.triggerType === 'checkbox') {
            const el = container.querySelector(discovery.trigger) || document.querySelector(discovery.trigger);
            if (el) {
                const wantChecked = discovery.value !== 'true';
                if (el.checked !== wantChecked) el.click();
            }
        }
        // Don't reset toggles — they opened panels that may be needed
    }

    // Extract form elements from a target (single element or container)
    async function extractElementsFromTarget(target) {
        const results = [];
        const tagName = target.tagName.toUpperCase();

        if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tagName)) {
            results.push(await extractElementData(target, 0));
        } else {
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

        if (request.action === 'autoFillForm') {
            const scopeSelector = request.scope || null;
            const testData = request.testData || [];
            const results = new Array(testData.length);

            // Helper: get fresh scope every time (AJAX may replace DOM nodes)
            function getScope() {
                if (!scopeSelector) return document;
                return document.querySelector(scopeSelector) || document;
            }

            // Helper: locate element, searching fresh scope + document fallback
            function findElementOnce(entry) {
                const root = getScope();
                let el = null;
                if (entry.id) el = root.querySelector(`#${CSS.escape(entry.id)}`);
                if (!el && entry.name) el = root.querySelector(`[name="${entry.name}"]`);
                if (!el && entry.cssSelector) {
                    try { el = root.querySelector(entry.cssSelector); } catch(e) {}
                }
                // Fallback: search entire document if scoped search failed
                if (!el && root !== document) {
                    if (entry.id) el = document.querySelector(`#${CSS.escape(entry.id)}`);
                    if (!el && entry.name) el = document.querySelector(`[name="${entry.name}"]`);
                }
                if (!el && entry.selector) {
                    try { el = document.querySelector(entry.selector); } catch(e) {}
                }
                return el;
            }

            // Helper: find element with retries (AJAX may still be loading new fields)
            async function findElement(entry, maxRetries = 5, retryDelay = 400) {
                let el = findElementOnce(entry);
                let attempt = 0;
                while (!el && attempt < maxRetries) {
                    attempt++;
                    await new Promise(r => setTimeout(r, retryDelay));
                    el = findElementOnce(entry);
                }
                return el;
            }

            // Helper: fire change event via page-context script injection
            // Content scripts run in an isolated world — window.jQuery is undefined there.
            // Injecting a <script> into the page world lets us trigger jQuery handlers.
            function fireChangeEvent(target) {
                const marker = '__fe_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                target.setAttribute('data-fe-marker', marker);

                // Native events from content script world
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));

                // Inject into PAGE world to trigger jQuery/framework handlers
                const script = document.createElement('script');
                script.textContent = `(function(){
                    var el = document.querySelector('[data-fe-marker="${marker}"]');
                    if (!el) return;
                    el.removeAttribute('data-fe-marker');
                    if (window.jQuery) { window.jQuery(el).trigger('change'); }
                    else if (window.$) { try { window.$(el).trigger('change'); } catch(e){} }
                    if (window.angular) {
                        var s = window.angular.element(el).scope();
                        if (s) { try { s.$apply(); } catch(e){} }
                    }
                })();`;
                document.documentElement.appendChild(script);
                script.remove();
            }

            // Helper: fill a single entry
            async function fillOne(entry, idx) {
                if (entry.skipped) {
                    results[idx] = { selector: entry.selector, status: 'skipped' };
                    return;
                }

                try {
                    const el = await findElement(entry);
                    if (!el) {
                        results[idx] = { selector: entry.selector || entry.id || entry.name, status: 'not-found' };
                        return;
                    }

                    const tagName = el.tagName.toUpperCase();
                    const elType = (el.type || '').toLowerCase();

                    // SELECT
                    if (tagName === 'SELECT') {
                        const valStr = String(entry.value);
                        const options = Array.from(el.options);
                        let matchedOpt = options.find(o => o.value === valStr);
                        if (!matchedOpt) matchedOpt = options.find(o => o.text.trim() === valStr);

                        if (matchedOpt) {
                            el.focus();
                            el.selectedIndex = matchedOpt.index;
                            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
                            if (nativeSetter) nativeSetter.call(el, matchedOpt.value);
                            fireChangeEvent(el);
                            el.blur();

                            // Wait for AJAX
                            await new Promise(r => setTimeout(r, 500));

                            // Verify — re-find the element (AJAX may have replaced it)
                            const freshEl = findElementOnce(entry);
                            if (freshEl && freshEl.value !== matchedOpt.value) {
                                freshEl.selectedIndex = matchedOpt.index;
                                if (nativeSetter) nativeSetter.call(freshEl, matchedOpt.value);
                                fireChangeEvent(freshEl);
                                await new Promise(r => setTimeout(r, 500));
                            }
                            const checkEl = findElementOnce(entry);
                            results[idx] = {
                                selector: entry.selector,
                                status: (checkEl && checkEl.value === matchedOpt.value) ? 'filled' : 'reverted',
                                value: checkEl ? checkEl.value : matchedOpt.value
                            };
                        } else {
                            results[idx] = { selector: entry.selector, status: 'error', error: `Option "${valStr}" not found` };
                        }
                    }
                    // RADIO
                    else if (elType === 'radio') {
                        const root = getScope();
                        const radios = root.querySelectorAll(`input[name="${el.name}"]`);
                        let found = false;
                        radios.forEach(r => {
                            if (r.value === String(entry.value)) {
                                r.checked = true;
                                fireChangeEvent(r);
                                found = true;
                            }
                        });
                        results[idx] = { selector: entry.selector, status: found ? 'filled' : 'not-found', value: entry.value };
                    }
                    // CHECKBOX
                    else if (elType === 'checkbox') {
                        const shouldCheck = entry.value === true || entry.value === 'true' || entry.value === 'Checked';
                        if (el.checked !== shouldCheck) {
                            el.click(); // Use click() — most reliable for checkboxes
                        }
                        results[idx] = { selector: entry.selector, status: 'filled', value: shouldCheck };
                    }
                    // React Select (custom dropdown)
                    else if (el.id && (el.id.includes('select') || el.id.includes('Select')) && el.closest('[class*="select"]')) {
                        const container = el.closest('[class*="select"]') || el.closest('[class*="Select"]');
                        const control = container ? (container.querySelector('[class*="control"]') || el) : el;
                        control.focus();
                        control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        control.click();
                        await new Promise(r => setTimeout(r, 300));
                        const menuOptions = document.querySelectorAll('[role="option"], .react-select__option, [class*="option"]');
                        let clicked = false;
                        menuOptions.forEach(opt => {
                            if (!clicked && opt.textContent.trim() === entry.displayValue) {
                                opt.click();
                                clicked = true;
                            }
                        });
                        if (!clicked) {
                            el.value = entry.value;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            await new Promise(r => setTimeout(r, 300));
                            const options2 = document.querySelectorAll('[role="option"]');
                            if (options2.length > 0) options2[0].click();
                        }
                        results[idx] = { selector: entry.selector, status: 'filled', value: entry.value };
                    }
                    // TEXT / TEXTAREA / other inputs
                    else {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
                        )?.set;
                        if (nativeInputValueSetter) {
                            nativeInputValueSetter.call(el, entry.value);
                        } else {
                            el.value = entry.value;
                        }
                        el.focus();
                        fireChangeEvent(el);
                        el.dispatchEvent(new Event('blur', { bubbles: true }));
                        results[idx] = { selector: entry.selector, status: 'filled', value: entry.value };
                    }

                    await new Promise(r => setTimeout(r, 50));
                } catch (err) {
                    results[idx] = { selector: entry.selector || entry.id, status: 'error', error: err.message };
                }
            }

            (async () => {
                // Fill in the order the user arranged (fields array order = fill order)
                for (let i = 0; i < testData.length; i++) {
                    const entry = testData[i];
                    await fillOne(entry, i);
                    // Wait after this field if specified by user
                    const waitMs = parseInt(entry.waitAfter) || 0;
                    if (waitMs > 0) {
                        await new Promise(r => setTimeout(r, waitMs));
                    }
                }

                // Verification pass: re-find and re-check all fields
                await new Promise(r => setTimeout(r, 800));
                for (let i = 0; i < testData.length; i++) {
                    const entry = testData[i];
                    if (entry.skipped || !results[i] || results[i].status === 'error' || results[i].status === 'not-found') continue;

                    const el = findElementOnce(entry);
                    if (!el) continue;
                    const tagName = el.tagName.toUpperCase();
                    const elType = (el.type || '').toLowerCase();

                    if (elType === 'radio' || elType === 'checkbox') continue;

                    if (tagName === 'SELECT') {
                        const valStr = String(entry.value);
                        const options = Array.from(el.options);
                        let matchedOpt = options.find(o => o.value === valStr);
                        if (!matchedOpt) matchedOpt = options.find(o => o.text.trim() === valStr);
                        if (matchedOpt && el.value !== matchedOpt.value) {
                            el.selectedIndex = matchedOpt.index;
                            results[i] = { selector: entry.selector, status: 'filled', value: matchedOpt.value, note: 're-applied' };
                        }
                    }
                    else if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
                        if (el.value !== String(entry.value)) {
                            const nativeSet = Object.getOwnPropertyDescriptor(
                                tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
                            )?.set;
                            if (nativeSet) nativeSet.call(el, entry.value); else el.value = entry.value;
                            fireChangeEvent(el);
                        }
                    }
                }
                sendResponse({ success: true, results: results });
            })();
            return true; // async response
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

        if (request.action === 'smartFillForm') {
            const scopeSelector = request.scope || null;
            smartFillAllFields(scopeSelector).then(result => {
                sendResponse({ success: true, data: result });
            }).catch(error => {
                console.error('Form Extractor SmartFill Error:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true;
        }
    });

    // ============================
    // SMART FILL — fills all fields iteratively including hidden ones
    // ============================

    async function smartFillAllFields(scopeSelector) {
        const MAX_ROUNDS = 5;
        const container = scopeSelector ? document.querySelector(scopeSelector) : document.body;
        if (!container) throw new Error('Scope container not found: ' + scopeSelector);

        const allFilledFields = [];   // accumulates every fill result across rounds
        const filledSelectors = new Set(); // tracks already-filled elements to avoid re-filling

        // Helper: fire change/input events through native + jQuery/Angular page world
        function fireChangeEvent(target) {
            const marker = '__fe_sf_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            target.setAttribute('data-fe-marker', marker);
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            const script = document.createElement('script');
            script.textContent = `(function(){
                var el=document.querySelector('[data-fe-marker="${marker}"]');
                if(!el)return;
                el.removeAttribute('data-fe-marker');
                if(window.jQuery){window.jQuery(el).trigger('change');window.jQuery(el).trigger('input');}
                else if(window.$){try{window.$(el).trigger('change');}catch(e){}}
                if(window.angular){var s=window.angular.element(el).scope();if(s){try{s.$apply();}catch(e){}}}
                if(window.React||window.__REACT_DEVTOOLS_GLOBAL_HOOK__){
                    var nativeInputValueSetter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
                    // already set by content script, just re-fire
                }
            })();`;
            document.documentElement.appendChild(script);
            script.remove();
        }

        // Helper: get unique selector for an element (for dedup)
        function elKey(el) {
            if (el.id) return '#' + el.id;
            if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
            return generateUniqueSelector(el);
        }

        // Helper: pick first non-empty, non-disabled option from a select
        function pickSelectOption(sel) {
            const opts = Array.from(sel.options).filter(o => o.value && !o.disabled && o.value !== '');
            return opts.length > 0 ? opts[0] : null;
        }

        // Helper: fill a React Select / custom combobox ([role="combobox"] or class*=select)
        async function fillReactSelect(el, roundIdx, triggeredBy) {
            // Find the control wrapper
            let control = el;
            const container = el.closest('[class*="select"],[class*="Select"],[data-testid]') || el.parentElement;

            // Find the clickable control (not the hidden input)
            const clickTarget = container ? (
                container.querySelector('[class*="control"],[class*="Control"]') ||
                container.querySelector('[role="combobox"]') ||
                el
            ) : el;

            clickTarget.focus();
            clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            clickTarget.click();
            await waitForDOMSettle(400);

            // Find the open menu and pick first option
            const menuSelectors = [
                '[role="listbox"]', '[role="option"]',
                '.react-select__menu', '.react-select__option',
                '[class*="menu"]', '[class*="Menu"]',
                '[class*="option"]:not([aria-disabled="true"])'
            ];

            let chosen = null;
            for (const sel of menuSelectors) {
                const items = document.querySelectorAll(sel);
                for (const item of items) {
                    if (item.offsetParent !== null && item.getAttribute('aria-disabled') !== 'true' && !item.classList.contains('disabled')) {
                        // Skip placeholder-like first items
                        const txt = item.textContent.trim();
                        if (txt && txt.length > 0) {
                            chosen = item;
                            break;
                        }
                    }
                }
                if (chosen) break;
            }

            if (chosen) {
                const displayValue = chosen.textContent.trim();
                chosen.click();
                await waitForDOMSettle(300);
                return { value: displayValue, displayValue, status: 'filled' };
            }

            // Close menu if nothing found
            document.body.click();
            await waitForDOMSettle(200);
            return { value: '', displayValue: '', status: 'not-found' };
        }

        // Helper: generate a random value for an element using the same logic as RandomDataGenerator
        function generateValue(el) {
            const type = (el.type || el.tagName || 'text').toLowerCase();
            const hints = [el.id || '', el.name || '', el.placeholder || '',
                           (document.querySelector(`label[for="${el.id}"]`) || {}).textContent || '',
                           el.getAttribute('aria-label') || ''].join(' ').toLowerCase();

            // Date types
            if (type === 'date') {
                const y = 1990 + Math.floor(Math.random() * 20);
                const m = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
                const d = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            if (type === 'datetime-local') {
                const y = 1990 + Math.floor(Math.random() * 20);
                const m = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
                const d = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
                const h = String(Math.floor(Math.random() * 24)).padStart(2, '0');
                const mi = String(Math.floor(Math.random() * 60)).padStart(2, '0');
                return `${y}-${m}-${d}T${h}:${mi}`;
            }
            if (type === 'time') {
                const h = String(Math.floor(Math.random() * 24)).padStart(2, '0');
                const mi = String(Math.floor(Math.random() * 60)).padStart(2, '0');
                return `${h}:${mi}`;
            }
            if (type === 'month') {
                const y = 2000 + Math.floor(Math.random() * 25);
                const m = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
                return `${y}-${m}`;
            }
            if (type === 'week') {
                const y = 2020 + Math.floor(Math.random() * 5);
                const w = String(Math.floor(Math.random() * 52) + 1).padStart(2, '0');
                return `${y}-W${w}`;
            }
            if (type === 'number' || type === 'range') {
                const min = parseFloat(el.min) || 0;
                const max = parseFloat(el.max) || 100;
                const step = parseFloat(el.step) || 1;
                const steps = Math.floor((max - min) / step);
                return String(min + Math.floor(Math.random() * (steps + 1)) * step);
            }
            if (type === 'color') {
                return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            }
            if (type === 'email') return `testuser${Math.floor(Math.random()*999)}@example.com`;
            if (type === 'tel' || type === 'phone') return `+1-${Math.floor(Math.random()*800+200)}-${Math.floor(Math.random()*800+200)}-${Math.floor(Math.random()*9000+1000)}`;
            if (type === 'url') return `https://www.example.com/test${Math.floor(Math.random()*999)}`;
            if (type === 'password') return `TestPass@${Math.floor(Math.random()*9999)}!`;
            if (type === 'textarea') return 'This is test data entered by Form Extractor smart fill. Lorem ipsum dolor sit amet.';

            // Text semantic detection
            if (/\b(first.?name|fname|given)\b/.test(hints)) return ['James','Mary','John','Patricia','Robert'][Math.floor(Math.random()*5)];
            if (/\b(last.?name|lname|surname)\b/.test(hints)) return ['Smith','Johnson','Williams','Brown','Jones'][Math.floor(Math.random()*5)];
            if (/\b(full.?name|your.?name)\b/.test(hints)) return ['James Smith','Mary Johnson','John Williams'][Math.floor(Math.random()*3)];
            if (/\be.?mail\b/.test(hints)) return `test${Math.floor(Math.random()*999)}@example.com`;
            if (/\b(phone|mobile|tel|cell)\b/.test(hints)) return `+1-555-${Math.floor(Math.random()*800+100)}-${Math.floor(Math.random()*9000+1000)}`;
            if (/\b(address|street)\b/.test(hints)) return `${Math.floor(Math.random()*9000+100)} Main Street`;
            if (/\b(city|town)\b/.test(hints)) return ['New York','Chicago','Houston','Phoenix'][Math.floor(Math.random()*4)];
            if (/\b(state|province)\b/.test(hints)) return ['California','Texas','Florida','New York'][Math.floor(Math.random()*4)];
            if (/\b(country|nation)\b/.test(hints)) return 'United States';
            if (/\b(zip|postal)\b/.test(hints)) return String(Math.floor(Math.random()*90000+10000));
            if (/\b(company|org)\b/.test(hints)) return 'Test Company Inc';
            if (/\b(password|passwd|pwd)\b/.test(hints)) return `TestPass@${Math.floor(Math.random()*9999)}!`;
            if (/\b(message|comment|description|note|feedback|bio)\b/.test(hints)) return 'This is a test message entered by the Form Extractor.';
            if (/\bname\b/.test(hints)) return ['Alice','Bob','Charlie','Diana'][Math.floor(Math.random()*4)];
            if (/\bage\b/.test(hints)) return String(Math.floor(Math.random()*50)+18);
            if (/\bsearch\b/.test(hints)) return 'test query';

            // Fallback: random word
            const chars = 'abcdefghijklmnopqrstuvwxyz';
            const len = 5 + Math.floor(Math.random()*7);
            let w = '';
            for (let i = 0; i < len; i++) w += chars[Math.floor(Math.random()*chars.length)];
            return w;
        }

        // Core: fill a single element, return a result record
        async function fillElement(el, roundIdx, triggeredBy) {
            const key = elKey(el);
            if (filledSelectors.has(key)) return null; // already filled

            const tagName = el.tagName.toUpperCase();
            const elType = (el.type || '').toLowerCase();

            // Skip non-interactive types
            if (['hidden','file','submit','reset','button','image'].includes(elType)) return null;
            if (tagName === 'BUTTON') return null;
            if (el.disabled || el.readOnly) return null;

            const label = findLabel(el) || el.getAttribute('aria-label') || el.placeholder || el.name || el.id || '';
            const selector = el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : generateUniqueSelector(el));

            const record = {
                label,
                type: elType || tagName.toLowerCase(),
                id: el.id || '',
                name: el.name || '',
                selector,
                xpath: XPathGenerator ? XPathGenerator.generate(el) : '',
                value: '',
                displayValue: '',
                status: 'error',
                round: roundIdx + 1,
                triggeredBy: triggeredBy || null
            };

            try {
                // ---- SELECT (native) ----
                if (tagName === 'SELECT') {
                    const opt = pickSelectOption(el);
                    if (opt) {
                        el.focus();
                        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
                        if (nativeSetter) nativeSetter.call(el, opt.value);
                        else el.value = opt.value;
                        el.selectedIndex = opt.index;
                        fireChangeEvent(el);
                        el.blur();
                        await waitForDOMSettle(400);
                        record.value = opt.value;
                        record.displayValue = opt.text;
                        record.status = 'filled';
                        filledSelectors.add(key);
                    } else {
                        record.status = 'no-options';
                    }
                    return record;
                }

                // ---- RADIO ----
                if (elType === 'radio') {
                    const groupSel = el.name ? `input[type="radio"][name="${el.name}"]` : null;
                    if (filledSelectors.has('radio-group::' + (el.name || key))) return null; // group already handled
                    filledSelectors.add('radio-group::' + (el.name || key));

                    const searchRoot = container !== document.body ? container : document;
                    const radios = groupSel
                        ? Array.from(searchRoot.querySelectorAll(groupSel))
                        : [el];
                    const enabled = radios.filter(r => !r.disabled);

                    if (enabled.length === 0) return record;

                    // Probe each radio to find which one reveals the most new fields.
                    // Snapshot visible fields BEFORE probing so we can detect newly revealed ones.
                    const beforeProbeSnapshot = snapshotVisible(container);
                    let bestRadio = enabled[enabled.length - 1]; // default: last option (usually most complex)
                    let bestRevealCount = -1;

                    for (const radio of enabled) {
                        radio.click();
                        radio.checked = true;
                        fireChangeEvent(radio);
                        await waitForDOMSettle(500);

                        const afterSnapshot = snapshotVisible(container);
                        const newlyVisible = [...afterSnapshot].filter(k => !beforeProbeSnapshot.has(k));

                        if (newlyVisible.length > bestRevealCount) {
                            bestRevealCount = newlyVisible.length;
                            bestRadio = radio;
                        }

                        // Stop probing once we found a radio that reveals fields
                        if (newlyVisible.length > 0) break;
                    }

                    // Make sure the winning radio is selected (may already be if we stopped early)
                    if (!bestRadio.checked) {
                        bestRadio.click();
                        bestRadio.checked = true;
                        fireChangeEvent(bestRadio);
                        await waitForDOMSettle(500);
                    }

                    record.value = bestRadio.value;
                    record.displayValue = findLabel(bestRadio) || bestRadio.value;
                    record.status = 'filled';
                    filledSelectors.add(key);
                    return record;
                }

                // ---- CHECKBOX ----
                if (elType === 'checkbox') {
                    if (!el.checked) {
                        el.click();
                        await waitForDOMSettle(200);
                    }
                    record.value = 'true';
                    record.displayValue = 'Checked';
                    record.status = 'filled';
                    filledSelectors.add(key);
                    return record;
                }

                // ---- REACT SELECT / custom combobox ----
                // Detect by role="combobox" or aria-haspopup="listbox" or class containing "select"
                const isReactSelect = (
                    el.getAttribute('role') === 'combobox' ||
                    el.getAttribute('aria-haspopup') === 'listbox' ||
                    (el.id && (el.id.toLowerCase().includes('react-select') || el.id.toLowerCase().includes('-input'))) ||
                    (el.closest('[class*="select__"],[class*="Select__"]') !== null)
                );
                if (isReactSelect && !el.disabled) {
                    const res = await fillReactSelect(el, roundIdx, triggeredBy);
                    record.value = res.value;
                    record.displayValue = res.displayValue;
                    record.status = res.status;
                    filledSelectors.add(key);
                    return record;
                }

                // ---- TEXT / TEXTAREA / DATE / NUMBER / COLOR / etc. ----
                if (['input','textarea'].includes(tagName.toLowerCase()) ||
                    ['text','email','tel','url','password','number','range','date','datetime-local',
                     'time','month','week','color','search','textarea'].includes(elType)) {
                    const val = generateValue(el);
                    const proto = tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                    if (nativeSetter) nativeSetter.call(el, val);
                    else el.value = val;
                    el.focus();
                    fireChangeEvent(el);
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                    record.value = val;
                    record.displayValue = val;
                    record.status = 'filled';
                    filledSelectors.add(key);
                    return record;
                }

            } catch (err) {
                record.status = 'error';
                record.error = err.message;
            }

            return record;
        }

        // Get all currently visible + enabled form fields in container
        function getVisibleFields(root) {
            const candidates = root.querySelectorAll(
                'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="button"]),' +
                'select, textarea, [role="combobox"][aria-haspopup="listbox"]'
            );
            return Array.from(candidates).filter(el => {
                if (el.disabled) return false;
                // Must be visible
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
                if (el.offsetParent === null && style.position !== 'fixed') return false;
                return true;
            });
        }

        // Snapshot visible element keys
        function snapshotVisible(root) {
            return new Set(getVisibleFields(root).map(elKey));
        }

        // ---- MAIN LOOP ----
        let round = 0;
        let prevSnapshot = new Set();

        while (round < MAX_ROUNDS) {
            const currentSnapshot = snapshotVisible(container);

            // Find fields not yet filled
            const pending = getVisibleFields(container).filter(el => {
                const key = elKey(el);
                // Radio groups: check group key
                if ((el.type || '').toLowerCase() === 'radio' && el.name) {
                    return !filledSelectors.has('radio-group::' + el.name);
                }
                return !filledSelectors.has(key);
            });

            if (pending.length === 0) break;

            console.log(`Form Extractor SmartFill: Round ${round + 1}, ${pending.length} pending fields`);

            for (const el of pending) {
                // Determine triggeredBy: was this element newly visible since last round?
                const key = elKey(el);
                const isNew = round > 0 && !prevSnapshot.has(key);
                const result = await fillElement(el, round, isNew ? 'appeared-in-round-' + round : null);
                if (result) {
                    allFilledFields.push(result);
                    // Wait a bit longer after selects/radios to let dependent fields reveal
                    if (['select', 'radio', 'checkbox'].includes(result.type)) {
                        await waitForDOMSettle(600);
                    }
                }
            }

            prevSnapshot = currentSnapshot;
            round++;

            // Wait for any AJAX/DOM reactions before next round
            await waitForDOMSettle(800);

            // Check if new fields appeared
            const nextSnapshot = snapshotVisible(container);
            const newKeys = [...nextSnapshot].filter(k => !currentSnapshot.has(k));
            if (newKeys.length === 0 && pending.every(el => filledSelectors.has(elKey(el)) || filledSelectors.has('radio-group::' + (el.name || '')))) {
                break; // nothing new appeared and everything is filled
            }
        }

        const filledCount = allFilledFields.filter(f => f.status === 'filled').length;
        const hiddenCount = allFilledFields.filter(f => f.triggeredBy && f.triggeredBy !== null && f.triggeredBy.startsWith('appeared')).length;

        console.log(`Form Extractor SmartFill: Done. ${filledCount} fields filled in ${round} round(s), ${hiddenCount} were hidden/triggered.`);

        return {
            smartFillAt: new Date().toISOString(),
            rounds: round,
            totalFieldsFilled: filledCount,
            hiddenFieldsFilled: hiddenCount,
            fields: allFilledFields
        };
    }

    console.log('Form Extractor: Content script loaded (v2 with picker + hidden discovery)');
})();
