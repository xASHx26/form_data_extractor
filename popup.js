// Popup UI Logic
document.addEventListener('DOMContentLoaded', function () {
    const extractBtn = document.getElementById('extractBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportDemoBtn = document.getElementById('exportDemoBtn');
    const pickSectionBtn = document.getElementById('pickSectionBtn');
    const scopeBanner = document.getElementById('scopeBanner');
    const scopeText = document.getElementById('scopeText');
    const clearScopeBtn = document.getElementById('clearScopeBtn');
    const discoveryProgress = document.getElementById('discoveryProgress');
    const discoveryText = document.getElementById('discoveryText');
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const customNameInput = document.getElementById('customName');
    const saveNameBtn = document.getElementById('saveNameBtn');
    const cacheInfo = document.getElementById('cacheInfo');
    const cacheText = document.getElementById('cacheText');
    const refreshBtn = document.getElementById('refreshBtn');

    // Auto Fill elements
    const autoFillBtn = document.getElementById('autoFillBtn');
    const autoFillPrompt = document.getElementById('autoFillPrompt');
    const autoFillYes = document.getElementById('autoFillYes');
    const autoFillNo = document.getElementById('autoFillNo');
    const addScenarioBtn = document.getElementById('addScenarioBtn');
    const regenAllBtn = document.getElementById('regenAllBtn');
    const runAllBtn = document.getElementById('runAllBtn');
    const scenariosList = document.getElementById('scenariosList');

    let currentData = null;
    let currentUrl = '';
    let isLoadedFromCache = false;
    let selectedScope = null; // { selector, tagName, id, className, elementCount }
    let targetTabId = null; // Tab ID of the page being inspected (used in panel mode)
    let scenarios = []; // Array of { id, name, fields: [...] }

    // ============================
    // PANEL MODE DETECTION
    // ============================

    const urlParams = new URLSearchParams(window.location.search);
    const isPanelMode = urlParams.get('mode') === 'panel';

    const panelBar = document.getElementById('panelBar');
    const closePanelBtn = document.getElementById('closePanelBtn');

    if (isPanelMode) {
        document.body.classList.add('panel-mode');
        panelBar.classList.remove('hidden');

        // Close panel button
        closePanelBtn.addEventListener('click', () => {
            window.close();
        });

        // Load pending scope and target tab from storage (set by background.js)
        chrome.storage.local.get(['pendingScope', 'targetTabId', 'targetTabUrl'], (result) => {
            if (result.pendingScope) {
                selectedScope = result.pendingScope;
                targetTabId = result.targetTabId;
                currentUrl = result.targetTabUrl || '';
                showScopeBanner(selectedScope);

                // Load saved name for the target URL
                if (currentUrl) {
                    chrome.storage.local.get([currentUrl], (nameResult) => {
                        if (nameResult[currentUrl]) {
                            customNameInput.value = nameResult[currentUrl];
                        }
                    });
                }

                // Auto-trigger extraction immediately
                showStatus('Extracting elements from selected section...', false);
                setTimeout(() => extractBtn.click(), 200);
            }
            // Clean up pending data
            chrome.storage.local.remove(['pendingScope', 'targetTabId', 'targetTabUrl']);
        });
    }

    // Helper: get the tab ID to message (panel mode uses stored targetTabId)
    async function getTargetTabId() {
        if (isPanelMode && targetTabId) {
            return targetTabId;
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab.url;
        return tab.id;
    }

    // ============================
    // CONTENT SCRIPT INJECTION HELPER
    // ============================

    // Programmatically inject content scripts if they aren't already loaded
    async function ensureContentScripts(tabId) {
        try {
            // Try a quick ping — if content script is loaded it will respond
            await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        } catch (e) {
            // Content script not loaded — inject programmatically
            console.log('Form Extractor: Injecting content scripts into tab', tabId);
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['xpath-generator.js', 'dependency-detector.js', 'data-processor.js', 'content.js']
            });
            // Small delay to let scripts initialize
            await new Promise(r => setTimeout(r, 150));
        }
    }

    // Send a message to content script with auto-injection fallback
    function sendMessageWithRetry(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, async (response) => {
                if (chrome.runtime.lastError) {
                    // First attempt failed — try injecting scripts then retry
                    try {
                        await ensureContentScripts(tabId);
                        chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else {
                                resolve(retryResponse);
                            }
                        });
                    } catch (injectError) {
                        reject(new Error('Failed to inject content scripts: ' + injectError.message));
                    }
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Load saved name for current URL
    async function loadSavedName() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab.url;

        chrome.storage.local.get([currentUrl], (result) => {
            if (result[currentUrl]) {
                customNameInput.value = result[currentUrl];
            }
        });
    }

    // Save form data to cache
    function cacheFormData(url, data) {
        const cacheKey = `form_cache_${url}`;
        const cacheData = {
            data: data,
            timestamp: Date.now(),
            url: url
        };
        chrome.storage.local.set({ [cacheKey]: cacheData }, () => {
            console.log('Form data cached for:', url);
        });
    }

    // Load cached form data
    async function loadCachedFormData() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentUrl = tab.url;
        const cacheKey = `form_cache_${currentUrl}`;

        return new Promise((resolve) => {
            chrome.storage.local.get([cacheKey], (result) => {
                if (result[cacheKey]) {
                    const cached = result[cacheKey];
                    const age = Date.now() - cached.timestamp;
                    const ageMinutes = Math.floor(age / 60000);

                    console.log('Found cached data, age:', ageMinutes, 'minutes');
                    resolve({ data: cached.data, ageMinutes });
                } else {
                    resolve(null);
                }
            });
        });
    }

    // Show cache info banner
    function showCacheInfo(ageMinutes) {
        const timeText = ageMinutes < 1 ? 'just now' :
            ageMinutes === 1 ? '1 minute ago' :
                `${ageMinutes} minutes ago`;
        cacheText.textContent = `Using cached data from ${timeText}`;
        cacheInfo.classList.remove('hidden');
        isLoadedFromCache = true;
    }

    // Hide cache info banner
    function hideCacheInfo() {
        cacheInfo.classList.add('hidden');
        isLoadedFromCache = false;
    }

    // Auto-load cached data on popup open
    async function autoLoadCache() {
        const cached = await loadCachedFormData();
        if (cached) {
            currentData = cached.data;
            displayData(currentData);
            showCacheInfo(cached.ageMinutes);
            exportBtn.disabled = false;
            exportCsvBtn.disabled = false;
            exportDemoBtn.disabled = false;
            autoFillBtn.disabled = false;
            emptyState.classList.add('hidden');
        }
    }

    // Refresh button - force re-extraction
    refreshBtn.addEventListener('click', () => {
        hideCacheInfo();
        extractBtn.click();
    });

    // ============================
    // SECTION PICKER
    // ============================

    pickSectionBtn.addEventListener('click', async () => {
        if (pickSectionBtn.classList.contains('active')) {
            // Cancel picking
            try {
                const tabId = await getTargetTabId();
                sendMessageWithRetry(tabId, { action: 'cancelPicker' }).catch(() => {});
            } catch (e) { /* ignore */ }
            pickSectionBtn.classList.remove('active');
            pickSectionBtn.innerHTML = '<span class="icon">🎯</span> Pick Section';
            return;
        }

        pickSectionBtn.classList.add('active');
        pickSectionBtn.innerHTML = '<span class="icon">⏹️</span> Cancel Pick';

        try {
            const tabId = await getTargetTabId();
            await ensureContentScripts(tabId);

            // Start the picker on the page — result will be sent to background.js
            // which opens a persistent panel window
            sendMessageWithRetry(tabId, { action: 'pickElement' }).then(response => {
                if (response && response.pickerStarted) {
                    showStatus('🎯 Picker active! Click a section on the page. A panel will open with results.', false);
                }
            }).catch(error => {
                pickSectionBtn.classList.remove('active');
                pickSectionBtn.innerHTML = '<span class="icon">🎯</span> Pick Section';
                showStatus('Error: ' + error.message, true);
            });
        } catch (error) {
            pickSectionBtn.classList.remove('active');
            pickSectionBtn.innerHTML = '<span class="icon">🎯</span> Pick Section';
            showStatus('Error: ' + error.message, true);
        }
    });

    // Show scope banner
    function showScopeBanner(scope) {
        let label = `<${scope.tagName}>`;
        if (scope.id) label += `#${scope.id}`;
        else if (scope.className) label += `.${scope.className.split(' ')[0]}`;
        label += ` (${scope.elementCount} elements)`;

        scopeText.textContent = `Selected: ${label}`;
        scopeBanner.classList.remove('hidden');
    }

    // Clear scope
    clearScopeBtn.addEventListener('click', () => {
        selectedScope = null;
        scopeBanner.classList.add('hidden');
        showStatus('Scope cleared. Will extract full page.', false);
    });

    // Show/hide discovery progress
    function showDiscoveryProgress(text) {
        discoveryText.textContent = text || 'Discovering hidden elements...';
        discoveryProgress.classList.remove('hidden');
    }

    function hideDiscoveryProgress() {
        discoveryProgress.classList.add('hidden');
    }

    // Save custom name for current URL
    saveNameBtn.addEventListener('click', () => {
        const customName = customNameInput.value.trim();
        if (customName && currentUrl) {
            chrome.storage.local.set({ [currentUrl]: customName }, () => {
                showStatus(`Name "${customName}" saved for this URL!`, false);
            });
        }
    });

    // Generate filename from URL or custom name
    function generateFilename(extension) {
        const customName = customNameInput.value.trim();

        if (customName) {
            // Use custom name if provided
            return `${customName}.${extension}`;
        }

        // Generate from URL
        try {
            const url = new URL(currentUrl);
            let baseName = url.hostname.replace(/^www\./, '');

            // Add path if not homepage
            if (url.pathname && url.pathname !== '/') {
                const pathParts = url.pathname.split('/').filter(p => p);
                if (pathParts.length > 0) {
                    baseName += '_' + pathParts.join('_');
                }
            }

            // Clean filename - remove invalid characters
            baseName = baseName.replace(/[^a-z0-9_-]/gi, '_');

            // Add timestamp for uniqueness
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

            return `${baseName}_${timestamp}.${extension}`;
        } catch (e) {
            // Fallback to timestamp
            return `form-data-${Date.now()}.${extension}`;
        }
    }

    // Load saved name and cached data on init (skip in panel mode — those query the wrong tab)
    if (!isPanelMode) {
        loadSavedName();
        autoLoadCache();
    }

    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // Update active tab button
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active tab panel
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === tabName) {
                    panel.classList.add('active');
                }
            });
        });
    });

    // Extract button click
    extractBtn.addEventListener('click', async () => {
        extractBtn.disabled = true;
        extractBtn.textContent = '⏳ Extracting...';
        showStatus('Analyzing page & discovering hidden elements...', false);
        showDiscoveryProgress('Extracting forms & cycling dropdowns for hidden elements...');
        hideCacheInfo();

        try {
            const tabId = await getTargetTabId();

            // In non-panel mode, also get URL for naming
            if (!isPanelMode) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                currentUrl = tab.url;
            }

            // Load saved name for this URL
            if (currentUrl) {
                chrome.storage.local.get([currentUrl], (result) => {
                    if (result[currentUrl]) {
                        customNameInput.value = result[currentUrl];
                    }
                });
            }

            // Send extraction message with optional scope
            const message = { action: 'extractForms' };
            if (selectedScope) {
                message.scope = selectedScope.selector;
            }

            sendMessageWithRetry(tabId, message).then(response => {
                hideDiscoveryProgress();

                if (response && response.success) {
                    currentData = response.data;
                    displayData(currentData);
                    const hiddenCount = currentData.metadata.totalHiddenDiscovered || 0;
                    const scopeLabel = selectedScope ? ' from selected section' : '';
                    showStatus(
                        `Extracted ${currentData.metadata.totalElements} elements from ${currentData.metadata.totalForms} form(s)${scopeLabel}` +
                        (hiddenCount > 0 ? ` • ${hiddenCount} hidden elements discovered!` : ''),
                        false
                    );

                    // Cache the extracted data
                    cacheFormData(currentUrl, currentData);

                    // Enable all export buttons
                    exportBtn.disabled = false;
                    exportCsvBtn.disabled = false;
                    exportDemoBtn.disabled = false;
                    autoFillBtn.disabled = false;
                    emptyState.classList.add('hidden');

                    // Show auto-fill prompt
                    autoFillPrompt.classList.remove('hidden');
                } else {
                    showStatus('Error: ' + (response?.error || 'Unknown error'), true);
                }

                extractBtn.disabled = false;
                extractBtn.innerHTML = '<span class="icon">⚡</span> Extract Forms';
            }).catch(error => {
                hideDiscoveryProgress();
                showStatus('Error: ' + error.message, true);
                extractBtn.disabled = false;
                extractBtn.innerHTML = '<span class="icon">⚡</span> Extract Forms';
            });
        } catch (error) {
            showStatus('Error: ' + error.message, true);
            extractBtn.disabled = false;
            extractBtn.innerHTML = '<span class="icon">⚡</span> Extract Forms';
        }
    });

    // Export JSON button click
    exportBtn.addEventListener('click', () => {
        if (!currentData) return;

        const jsonData = JSON.stringify(currentData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = generateFilename('json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        showStatus('JSON exported successfully!', false);
    });

    // Export CSV button click
    exportCsvBtn.addEventListener('click', () => {
        if (!currentData) return;

        const csvData = DataProcessorPopup.exportToCSV(currentData);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = generateFilename('csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        showStatus('CSV exported successfully!', false);
    });

    // Export Demo JSON button click (for automation template)
    exportDemoBtn.addEventListener('click', () => {
        if (!currentData) return;

        const demoJson = DemoJsonGenerator.generateDemoJson(currentData);
        const jsonData = JSON.stringify(demoJson, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const customName = customNameInput.value.trim();
        const filename = customName ? `${customName}_automation_template.json` : generateFilename('automation_template.json');
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        showStatus('Demo JSON for automation exported successfully! 🤖', false);
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        if (!currentData) return;

        const searchTerm = e.target.value.toLowerCase();
        const elementCards = document.querySelectorAll('.element-card');

        elementCards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    });

    // Display extracted data
    function displayData(data) {
        displayOverview(data);
        displayElements(data);
        displayDependencies(data);
    }

    // Display overview tab
    function displayOverview(data) {
        document.getElementById('totalForms').textContent = data.metadata.totalForms;
        document.getElementById('totalElements').textContent = data.metadata.totalElements;
        document.getElementById('totalDependencies').textContent = data.metadata.totalDependencies;
        document.getElementById('totalHidden').textContent = data.metadata.totalHiddenDiscovered || 0;

        const formsList = document.getElementById('formsList');
        formsList.innerHTML = '';

        data.forms.forEach(form => {
            const formCard = createFormCard(form);
            formsList.appendChild(formCard);
        });

        // Show quick element summary table in overview
        const allElements = [...(data.elements || []), ...(data.hiddenElements || [])];
        if (allElements.length > 0) {
            const header = document.createElement('div');
            header.className = 'hidden-section-header';
            header.style.marginTop = '12px';
            header.innerHTML = `\ud83d\udcdd All Elements (${allElements.length})`;
            formsList.appendChild(header);

            // Search bar for overview
            const searchWrap = document.createElement('div');
            searchWrap.className = 'overview-search';
            searchWrap.innerHTML = '<input type="text" class="overview-search-input" placeholder="\ud83d\udd0d Search elements by ID, name, type, label...">';
            formsList.appendChild(searchWrap);

            const tableWrap = document.createElement('div');
            tableWrap.className = 'element-table-wrap';
            let tableHtml = `<table class="element-table">
                <thead><tr>
                    <th>#</th><th>Type</th><th>Label</th><th>Identifier</th><th>Best Locator</th><th></th>
                </tr></thead><tbody>`;

            allElements.forEach((el, idx) => {
                const identifier = el.id || el.name || el.placeholder || '(unnamed)';
                const label = el.label || el.ariaLabel || '';
                const bestLocator = el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : el.cssSelector || el.xpath);
                const isHiddenEl = el.visibility && el.visibility.initiallyHidden;
                tableHtml += `<tr class="element-table-row${isHiddenEl ? ' row-hidden' : ''}">
                    <td>${idx + 1}</td>
                    <td><span class="element-type type-${el.type.replace(/\[.*\]/, '')}" style="font-size:10px;padding:2px 6px;">${escapeHtml(el.type)}</span></td>
                    <td class="cell-label">${escapeHtml(label)}${isHiddenEl ? ' <span class="visibility-badge badge-hidden" style="font-size:9px;padding:1px 4px;">\ud83d\udc41\ufe0f</span>' : ''}</td>
                    <td class="cell-identifier">${escapeHtml(identifier)}</td>
                    <td class="cell-locator"><code>${escapeHtml(bestLocator)}</code></td>
                    <td><button class="copy-locator-btn table-copy-btn" data-copy-value="${escapeHtml(bestLocator)}" title="Copy">\ud83d\udccb</button></td>
                </tr>`;
            });
            tableHtml += '</tbody></table>';
            tableWrap.innerHTML = tableHtml;
            formsList.appendChild(tableWrap);

            // Wire copy buttons in table
            tableWrap.querySelectorAll('.table-copy-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    // Read value from the adjacent code cell instead of attribute (avoids encoding issues)
                    const row = btn.closest('tr');
                    const codeEl = row.querySelector('.cell-locator code');
                    const value = codeEl ? codeEl.textContent : '';
                    navigator.clipboard.writeText(value).then(() => {
                        btn.textContent = '\u2713';
                        btn.style.color = '#28a745';
                        setTimeout(() => { btn.textContent = '\ud83d\udccb'; btn.style.color = ''; }, 1500);
                    });
                });
            });

            // Wire overview search
            const overviewSearch = searchWrap.querySelector('.overview-search-input');
            overviewSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                tableWrap.querySelectorAll('.element-table-row').forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
                });
            });
        }
    }

    // Create form card
    function createFormCard(form) {
        const card = document.createElement('div');
        card.className = 'form-card';

        const typeCount = Object.entries(form.statistics.byType)
            .map(([type, count]) => `${count} ${type}`)
            .join(', ');

        card.innerHTML = `
      <div class="form-header">
        <div class="form-title">${escapeHtml(form.name)}</div>
        <div class="form-badge">${form.elementCount} elements</div>
      </div>
      <div class="form-info">
        <div><strong>ID:</strong> ${escapeHtml(form.id) || '(none)'}</div>
        <div><strong>Action:</strong> ${escapeHtml(form.action) || '(none)'}</div>
        <div><strong>Method:</strong> ${form.method.toUpperCase()}</div>
        <div><strong>Elements:</strong> ${typeCount}</div>
        <div style="font-size: 10px; margin-top: 5px; word-break: break-all;">
          <strong>XPath:</strong> <code>${escapeHtml(form.xpath)}</code>
        </div>
      </div>
    `;

        return card;
    }

    // Display elements tab
    function displayElements(data) {
        const elementsList = document.getElementById('elementsList');
        elementsList.innerHTML = '';

        const allVisible = data.elements || [];
        const allHidden = data.hiddenElements || [];

        if (allVisible.length === 0 && allHidden.length === 0) {
            elementsList.innerHTML = '<p style="text-align: center; color: #6c757d;">No elements found</p>';
            return;
        }

        // Render visible / always-present elements
        allVisible.forEach(element => {
            const card = createElementCard(element);
            elementsList.appendChild(card);
        });

        // Render hidden (discovered) elements with a separator
        if (allHidden.length > 0) {
            const header = document.createElement('div');
            header.className = 'hidden-section-header';
            header.innerHTML = `👁️ Hidden Elements Discovered (${allHidden.length})`;
            elementsList.appendChild(header);

            allHidden.forEach(element => {
                const card = createElementCard(element, true);
                elementsList.appendChild(card);
            });
        }
    }

    // Create element card
    function createElementCard(element, isHidden = false) {
        const card = document.createElement('div');
        card.className = 'element-card' + (isHidden ? ' type-hidden' : '');

        const typeClass = `type-${element.type.replace(/\[.*\]/, '')}`;

        const optionsHtml = element.options && element.options.length > 0
            ? `<div class="detail-row">
           <span class="detail-label">Options:</span>
           <span class="detail-value">${element.options.length} option(s)</span>
         </div>`
            : '';

        const groupOptionsHtml = element.groupOptions && element.groupOptions.length > 0
            ? `<div class="detail-row">
           <span class="detail-label">Group:</span>
           <span class="detail-value">${element.groupOptions.length} option(s)</span>
         </div>`
            : '';

        // Visibility badge
        let visibilityBadgeHtml = '';
        const vis = element.visibility;
        if (vis && vis.initiallyHidden) {
            visibilityBadgeHtml = '<span class="visibility-badge badge-hidden">👁️ Hidden</span>';
        } else if (vis && vis.triggeredBy) {
            visibilityBadgeHtml = '<span class="visibility-badge badge-conditional">🔓 Conditional</span>';
        }

        // Trigger info
        let triggerInfoHtml = '';
        if (vis && vis.triggeredBy) {
            triggerInfoHtml = `
                <div class="trigger-info">
                    <strong>Triggered by:</strong> <code>${escapeHtml(vis.triggeredBy)}</code>
                    = "${escapeHtml(vis.triggerValueText || vis.triggerValue || '')}"
                    ${vis.changeType ? `<span style="margin-left:6px;color:#6c757d;">(${escapeHtml(vis.changeType)})</span>` : ''}
                </div>`;
        }

        // Build locators list — each locator gets its own copy button
        const locators = [];
        if (element.id) locators.push({ label: 'ID', value: `#${element.id}`, type: 'id' });
        if (element.name) locators.push({ label: 'Name', value: `[name="${element.name}"]`, type: 'name' });
        locators.push({ label: 'XPath', value: element.xpath || '', type: 'xpath' });
        locators.push({ label: 'CSS', value: element.cssSelector || '', type: 'css' });
        if (element.reactSelectors) {
            if (element.reactSelectors.testId) locators.push({ label: 'TestID', value: element.reactSelectors.testId, type: 'testid' });
            if (element.reactSelectors.role) locators.push({ label: 'Role', value: element.reactSelectors.role, type: 'role' });
        }

        const locatorsHtml = locators
            .filter(l => l.value)
            .map(l => `
                <div class="locator-row">
                    <span class="locator-label">${l.label}</span>
                    <code class="locator-value">${escapeHtml(l.value)}</code>
                    <button class="copy-locator-btn" title="Copy ${l.label}">📋</button>
                </div>
            `).join('');

        card.innerHTML = `
      <div class="element-header">
        <span class="element-type ${typeClass}">${element.type}</span>
        ${visibilityBadgeHtml}
        ${element.label ? `<span class="element-label-text">${escapeHtml(element.label)}</span>` : ''}
      </div>
      ${triggerInfoHtml}
      <div class="element-details">
        ${element.id ? `<div class="detail-row"><span class="detail-label">ID:</span><span class="detail-value">${escapeHtml(element.id)}</span></div>` : ''}
        ${element.name ? `<div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${escapeHtml(element.name)}</span></div>` : ''}
        ${element.placeholder ? `<div class="detail-row"><span class="detail-label">Placeholder:</span><span class="detail-value">${escapeHtml(element.placeholder)}</span></div>` : ''}
        ${optionsHtml}
        ${groupOptionsHtml}
        ${element.required ? '<div style="color: #dc3545; font-size: 11px;">⚠ Required</div>' : ''}
        ${element.disabled ? '<div style="color: #6c757d; font-size: 11px;">🚫 Disabled</div>' : ''}
      </div>
      <div class="locators-section">
        <div class="locators-header">📍 Locators <span class="copy-all-btn" title="Copy all locators">Copy All</span></div>
        ${locatorsHtml}
      </div>
    `;

        // Wire up individual copy buttons — read from the <code> text, not from data attribute
        card.querySelectorAll('.copy-locator-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = btn.closest('.locator-row');
                const value = row.querySelector('.locator-value').textContent;
                navigator.clipboard.writeText(value).then(() => {
                    btn.textContent = '✓';
                    btn.style.color = '#28a745';
                    setTimeout(() => { btn.textContent = '📋'; btn.style.color = ''; }, 1500);
                });
            });
        });

        // Wire up "Copy All" button
        const copyAllBtn = card.querySelector('.copy-all-btn');
        if (copyAllBtn) {
            copyAllBtn.addEventListener('click', () => {
                const allText = locators.filter(l => l.value).map(l => `${l.label}: ${l.value}`).join('\n');
                navigator.clipboard.writeText(allText).then(() => {
                    copyAllBtn.textContent = '✓ Copied!';
                    setTimeout(() => { copyAllBtn.textContent = 'Copy All'; }, 1500);
                });
            });
        }

        return card;
    }

    // Display dependencies tab
    function displayDependencies(data) {
        const dependenciesList = document.getElementById('dependenciesList');
        dependenciesList.innerHTML = '';

        const deps = data.dependencies || [];
        const triggerMap = data.triggerMap || [];

        if (deps.length === 0 && triggerMap.length === 0) {
            // Show element relationships even if no formal dependencies found
            const allElements = [...(data.elements || []), ...(data.hiddenElements || [])];
            if (allElements.length > 0) {
                dependenciesList.innerHTML = `
                    <p style="text-align: center; color: #6c757d; margin-bottom: 12px;">No static dependencies detected</p>
                    <p style="text-align: center; color: #999; font-size: 11px;">Dependencies are detected from data attributes (data-depends-on, data-show-when, etc.) and toggle patterns. Hidden element triggers are shown under \ud83d\udd0d Discovered Trigger Mappings if any were found.</p>
                `;
            } else {
                dependenciesList.innerHTML = '<p style="text-align: center; color: #6c757d;">No dependencies detected</p>';
            }
            return;
        }

        // Static dependencies
        deps.forEach((dep, index) => {
            const card = createDependencyCard(dep, index);
            dependenciesList.appendChild(card);
        });

        // Dynamic trigger map entries
        if (triggerMap.length > 0) {
            const header = document.createElement('div');
            header.className = 'hidden-section-header';
            header.innerHTML = `🔍 Discovered Trigger Mappings (${triggerMap.length})`;
            dependenciesList.appendChild(header);

            triggerMap.forEach((entry, index) => {
                const card = createTriggerMapCard(entry, index);
                dependenciesList.appendChild(card);
            });
        }
    }

    // Create dependency card
    function createDependencyCard(dependency, index) {
        const card = document.createElement('div');
        card.className = 'dependency-card';

        const typeEmoji = {
            'controls': '🎛️',
            'enables': '✅',
            'shows': '👁️',
            'toggles': '🔄',
            'requires': '⚠️',
            'conditionally-shows': '❓'
        };

        const discoveredBadge = dependency.discoveredDynamically
            ? '<span class="visibility-badge badge-conditional" style="margin-left:8px;">🔍 Discovered</span>'
            : '';

        card.innerHTML = `
      <div class="dependency-title">
        ${typeEmoji[dependency.type] || '🔗'} ${dependency.type.toUpperCase()}
        ${discoveredBadge}
      </div>
      <div class="dependency-info">
        <strong>Source:</strong> <code>${escapeHtml(dependency.source)}</code>
        <span class="dependency-arrow">→</span>
        <strong>Target:</strong> <code>${escapeHtml(dependency.target)}</code>
        ${dependency.condition ? `<div style="margin-top: 5px;"><strong>Condition:</strong> ${escapeHtml(dependency.condition)}</div>` : ''}
      </div>
    `;

        return card;
    }

    // Create trigger map card for discovered trigger-value mappings
    function createTriggerMapCard(entry, index) {
        const card = document.createElement('div');
        card.className = 'dependency-card type-hidden';

        const triggerTypeEmoji = {
            'select': '📋',
            'radio': '🔘',
            'checkbox': '☑️'
        };

        const valuesHtml = (entry.triggerValues || []).map(tv => {
            const reveals = (tv.revealsElements || []).map(el =>
                `<div style="font-size:10px;margin-left:12px;">• <code>${escapeHtml(el)}</code></div>`
            ).join('');
            const changeTypes = (tv.changeTypes || []).join(', ');
            return `
                <div class="trigger-value-item">
                    <strong>"${escapeHtml(tv.valueText || tv.value)}"</strong>
                    ${changeTypes ? `<span style="color:#6c757d;font-size:10px;"> (${escapeHtml(changeTypes)})</span>` : ''}
                    ${reveals ? `<div style="margin-top:2px;">${reveals}</div>` : '<div style="font-size:10px;margin-left:12px;color:#6c757d;">No elements revealed</div>'}
                </div>`;
        }).join('');

        card.innerHTML = `
      <div class="dependency-title">
        ${triggerTypeEmoji[entry.triggerType] || '🎯'} TRIGGER: ${escapeHtml(entry.triggerType || '').toUpperCase()}
        <span class="visibility-badge badge-hidden" style="margin-left:8px;">🔍 Dynamic</span>
      </div>
      <div class="dependency-info">
        <strong>Trigger Element:</strong> <code>${escapeHtml(entry.trigger)}</code>
      </div>
      <div class="trigger-values-list">
        ${valuesHtml || '<p style="color:#6c757d;font-size:11px;">No values mapped</p>'}
      </div>
    `;

        return card;
    }

    // Show status message
    function showStatus(message, isError) {
        statusText.textContent = message;
        statusBar.classList.remove('hidden');

        if (isError) {
            statusBar.classList.add('error');
        } else {
            statusBar.classList.remove('error');
        }

        setTimeout(() => {
            statusBar.classList.add('hidden');
        }, 5000);
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================
    // AUTO FILL LOGIC
    // ============================

    let scenarioIdCounter = 0;

    function generateNewScenario(name) {
        if (!currentData || !currentData.elements || currentData.elements.length === 0) return null;
        const allElements = [...(currentData.elements || []), ...(currentData.hiddenElements || [])];
        const fields = RandomDataGenerator.generateScenario(allElements);
        scenarioIdCounter++;
        return {
            id: scenarioIdCounter,
            name: name || `Scenario ${scenarioIdCounter}`,
            fields: fields
        };
    }

    function initAutoFill() {
        scenarios = [];
        scenarioIdCounter = 0;
        const s = generateNewScenario('Scenario 1');
        if (s) scenarios.push(s);
        renderScenarios();
        switchToTab('autofill');
    }

    function switchToTab(tabName) {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabButtons.forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tabName);
        });
        tabPanels.forEach(p => {
            p.classList.toggle('active', p.id === tabName);
        });
    }

    // Post-extraction prompt
    autoFillYes.addEventListener('click', () => {
        autoFillPrompt.classList.add('hidden');
        initAutoFill();
    });

    autoFillNo.addEventListener('click', () => {
        autoFillPrompt.classList.add('hidden');
    });

    // Auto Fill button
    autoFillBtn.addEventListener('click', () => {
        if (!currentData) return;
        if (scenarios.length === 0) {
            initAutoFill();
        } else {
            switchToTab('autofill');
        }
    });

    // Add Scenario
    addScenarioBtn.addEventListener('click', () => {
        if (!currentData) return;
        const s = generateNewScenario();
        if (s) {
            scenarios.push(s);
            renderScenarios();
        }
    });

    // Regenerate All
    regenAllBtn.addEventListener('click', () => {
        if (!currentData) return;
        const allElements = [...(currentData.elements || []), ...(currentData.hiddenElements || [])];
        scenarios.forEach(sc => {
            sc.fields = RandomDataGenerator.generateScenario(allElements);
        });
        renderScenarios();
        showStatus('All scenarios regenerated with new random data', false);
    });

    // Run All
    runAllBtn.addEventListener('click', async () => {
        if (scenarios.length === 0) return;
        runAllBtn.disabled = true;
        runAllBtn.textContent = '⏳ Running...';

        for (let i = 0; i < scenarios.length; i++) {
            showStatus(`Running scenario ${i + 1} of ${scenarios.length}...`, false);
            await runScenario(scenarios[i].id);
            if (i < scenarios.length - 1) {
                await new Promise(r => setTimeout(r, 800));
            }
        }

        runAllBtn.disabled = false;
        runAllBtn.textContent = '▶️ Run All';
        showStatus(`All ${scenarios.length} scenario(s) completed!`, false);
    });

    // Run a single scenario
    async function runScenario(scenarioId) {
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;

        const tabId = await getTargetTabId();
        const message = {
            action: 'autoFillForm',
            scope: selectedScope ? selectedScope.selector : null,
            testData: scenario.fields
        };

        try {
            const response = await sendMessageWithRetry(tabId, message);
            if (response && response.success) {
                const results = response.results || [];
                let filledCount = 0, errorCount = 0, skippedCount = 0;

                results.forEach((r, idx) => {
                    if (idx < scenario.fields.length) {
                        scenario.fields[idx].fillStatus = r.status;
                    }
                    if (r.status === 'filled') filledCount++;
                    else if (r.status === 'error' || r.status === 'not-found' || r.status === 'reverted') errorCount++;
                    else skippedCount++;
                });

                renderScenarios();

                const totalAttempted = filledCount + errorCount;
                if (errorCount === 0) {
                    showStatus(`✅ ${scenario.name}: Filled ${filledCount} field(s) successfully`, false);
                } else {
                    showStatus(`⚠️ ${scenario.name}: ${filledCount}/${totalAttempted} filled, ${errorCount} failed`, true);
                }
            } else {
                showStatus(`Error running ${scenario.name}: ${response?.error || 'Unknown'}`, true);
            }
        } catch (err) {
            showStatus(`Error: ${err.message}`, true);
        }
    }

    // Duplicate scenario
    function duplicateScenario(scenarioId) {
        const source = scenarios.find(s => s.id === scenarioId);
        if (!source) return;
        scenarioIdCounter++;
        const copy = {
            id: scenarioIdCounter,
            name: `${source.name} (copy)`,
            fields: source.fields.map(f => ({ ...f, fillStatus: undefined }))
        };
        const idx = scenarios.findIndex(s => s.id === scenarioId);
        scenarios.splice(idx + 1, 0, copy);
        renderScenarios();
    }

    // Delete scenario
    function deleteScenario(scenarioId) {
        scenarios = scenarios.filter(s => s.id !== scenarioId);
        renderScenarios();
    }

    // Regenerate single scenario
    function regenScenario(scenarioId) {
        const sc = scenarios.find(s => s.id === scenarioId);
        if (!sc || !currentData) return;
        const allElements = [...(currentData.elements || []), ...(currentData.hiddenElements || [])];
        sc.fields = RandomDataGenerator.generateScenario(allElements);
        renderScenarios();
    }

    // Get type badge color class
    function getTypeBadgeStyle(type) {
        const colors = {
            'text': '#155724;background:#d4edda', 'email': '#155724;background:#d4edda',
            'tel': '#155724;background:#d4edda', 'url': '#155724;background:#d4edda',
            'password': '#856404;background:#fff3cd', 'number': '#856404;background:#fff3cd',
            'date': '#0c5460;background:#d1ecf1', 'datetime-local': '#0c5460;background:#d1ecf1',
            'time': '#0c5460;background:#d1ecf1', 'month': '#0c5460;background:#d1ecf1',
            'select': '#004085;background:#cce5ff', 'select-one': '#004085;background:#cce5ff',
            'radio': '#6f42c1;background:#e7d5f7', 'checkbox': '#0c5460;background:#d1ecf1',
            'textarea': '#856404;background:#fff3cd', 'range': '#856404;background:#fff3cd',
            'color': '#333;background:#f0f0f0', 'file': '#6c757d;background:#e9ecef',
            'hidden': '#6c757d;background:#e9ecef', 'submit': '#721c24;background:#f8d7da',
            'button': '#721c24;background:#f8d7da'
        };
        return colors[type] || '#333;background:#f0f0f0';
    }

    // Render all scenarios
    function renderScenarios() {
        scenariosList.innerHTML = '';

        if (scenarios.length === 0) {
            scenariosList.innerHTML = '<p class="autofill-empty">No scenarios yet. Click <strong>Add Scenario</strong> or extract a form and accept the auto-fill prompt.</p>';
            return;
        }

        scenarios.forEach(scenario => {
            const card = document.createElement('div');
            card.className = 'scenario-card';

            // Header
            const header = document.createElement('div');
            header.className = 'scenario-header';
            header.innerHTML = `
                <div class="scenario-title">
                    📋 <input type="text" class="scenario-title-input" value="${escapeHtml(scenario.name)}" data-sc-id="${scenario.id}">
                </div>
                <div class="scenario-actions">
                    <button class="btn-sc-run" data-sc-id="${scenario.id}">▶ Run</button>
                    <button class="btn-sc-regen" data-sc-id="${scenario.id}">🎲 Regen</button>
                    <button class="btn-sc-dup" data-sc-id="${scenario.id}">📄 Dup</button>
                    <button class="btn-sc-del" data-sc-id="${scenario.id}">🗑️ Del</button>
                </div>
            `;
            card.appendChild(header);

            // Table
            const tableWrap = document.createElement('div');
            tableWrap.className = 'scenario-table-wrap';
            let rows = '';

            scenario.fields.forEach((field, idx) => {
                // Ensure fillOrder exists (backward compat)
                if (field.fillOrder === undefined) field.fillOrder = idx;
                if (field.waitAfter === undefined) field.waitAfter = 0;

                const typeStyle = getTypeBadgeStyle(field.type);
                const statusIcon = field.fillStatus
                    ? `<span class="fill-status status-${field.fillStatus}" title="${field.fillStatus}">${field.fillStatus === 'filled' ? '✅' : field.fillStatus === 'skipped' ? '⏭️' : field.fillStatus === 'not-found' ? '⚠️' : field.fillStatus === 'reverted' ? '🔄' : '❌'}</span>`
                    : '';
                const rowClass = field.skipped ? 'row-skipped' : '';
                const displayLabel = field.label || field.id || field.name || `Field ${idx + 1}`;

                let valueCell = '';
                if (field.skipped) {
                    valueCell = `<span style="color:#999;font-style:italic;">${escapeHtml(field.displayValue)}</span>`;
                } else if (field.type === 'checkbox') {
                    const isChecked = field.value === true || field.value === 'true' || field.value === 'Checked';
                    valueCell = `<input type="checkbox" class="field-value-checkbox" data-sc-id="${scenario.id}" data-field-idx="${idx}" ${isChecked ? 'checked' : ''}>`;
                } else if ((field.type === 'select' || field.type === 'select-one') && field.options && field.options.length > 0) {
                    const optionsHtml = field.options.map(o =>
                        `<option value="${escapeHtml(o.value)}" ${o.value === field.value ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${escapeHtml(o.text || o.value)}</option>`
                    ).join('');
                    valueCell = `<select class="field-value-select" data-sc-id="${scenario.id}" data-field-idx="${idx}">${optionsHtml}</select>`;
                } else if (field.type === 'radio' && field.groupOptions && field.groupOptions.length > 0) {
                    const optionsHtml = field.groupOptions.map(o =>
                        `<option value="${escapeHtml(o.value)}" ${o.value === field.value ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${escapeHtml(o.label || o.value)}</option>`
                    ).join('');
                    valueCell = `<select class="field-value-select" data-sc-id="${scenario.id}" data-field-idx="${idx}">${optionsHtml}</select>`;
                } else {
                    valueCell = `<input type="text" class="field-value-input" data-sc-id="${scenario.id}" data-field-idx="${idx}" value="${escapeHtml(String(field.value))}">`;
                }

                // Reorder + Wait controls
                const isFirst = idx === 0;
                const isLast = idx === scenario.fields.length - 1;
                const orderCell = `<span class="field-order-controls">`
                    + `<button class="btn-order-up" data-sc-id="${scenario.id}" data-field-idx="${idx}" ${isFirst ? 'disabled' : ''} title="Move up">▲</button>`
                    + `<button class="btn-order-down" data-sc-id="${scenario.id}" data-field-idx="${idx}" ${isLast ? 'disabled' : ''} title="Move down">▼</button>`
                    + `</span>`;
                const waitCell = `<input type="number" class="field-wait-input" data-sc-id="${scenario.id}" data-field-idx="${idx}" value="${field.waitAfter}" min="0" step="100" title="Wait (ms) after filling this field">`;

                rows += `<tr class="${rowClass}">
                    <td class="td-order">${orderCell}</td>
                    <td><span class="field-type-badge" style="color:${typeStyle}">${escapeHtml(field.type)}</span></td>
                    <td class="field-label-cell" title="${escapeHtml(displayLabel)}">${escapeHtml(displayLabel)}</td>
                    <td style="min-width:150px;">${valueCell}</td>
                    <td class="td-wait">${waitCell}</td>
                    <td>${statusIcon}</td>
                </tr>`;
            });

            tableWrap.innerHTML = `<table class="scenario-table">
                <thead><tr><th class="th-order">Order</th><th>Type</th><th>Label</th><th>Value</th><th class="th-wait">Wait(ms)</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
            card.appendChild(tableWrap);

            scenariosList.appendChild(card);

            // Wire scenario header buttons
            header.querySelector('.btn-sc-run').addEventListener('click', () => runScenario(scenario.id));
            header.querySelector('.btn-sc-regen').addEventListener('click', () => regenScenario(scenario.id));
            header.querySelector('.btn-sc-dup').addEventListener('click', () => duplicateScenario(scenario.id));
            header.querySelector('.btn-sc-del').addEventListener('click', () => deleteScenario(scenario.id));

            // Wire name input
            header.querySelector('.scenario-title-input').addEventListener('change', (e) => {
                const sc = scenarios.find(s => s.id === scenario.id);
                if (sc) sc.name = e.target.value;
            });

            // Wire value edits
            tableWrap.querySelectorAll('.field-value-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const scId = parseInt(e.target.dataset.scId);
                    const fIdx = parseInt(e.target.dataset.fieldIdx);
                    const sc = scenarios.find(s => s.id === scId);
                    if (sc && sc.fields[fIdx]) {
                        sc.fields[fIdx].value = e.target.value;
                        sc.fields[fIdx].displayValue = e.target.value;
                        sc.fields[fIdx].fillStatus = undefined;
                    }
                });
            });

            tableWrap.querySelectorAll('.field-value-select').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    const scId = parseInt(e.target.dataset.scId);
                    const fIdx = parseInt(e.target.dataset.fieldIdx);
                    const sc = scenarios.find(s => s.id === scId);
                    if (sc && sc.fields[fIdx]) {
                        sc.fields[fIdx].value = e.target.value;
                        sc.fields[fIdx].displayValue = e.target.options[e.target.selectedIndex]?.text || e.target.value;
                        sc.fields[fIdx].fillStatus = undefined;
                    }
                });
            });

            tableWrap.querySelectorAll('.field-value-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const scId = parseInt(e.target.dataset.scId);
                    const fIdx = parseInt(e.target.dataset.fieldIdx);
                    const sc = scenarios.find(s => s.id === scId);
                    if (sc && sc.fields[fIdx]) {
                        sc.fields[fIdx].value = e.target.checked;
                        sc.fields[fIdx].displayValue = e.target.checked ? 'Checked' : 'Unchecked';
                        sc.fields[fIdx].fillStatus = undefined;
                    }
                });
            });

            // Wire wait-after inputs
            tableWrap.querySelectorAll('.field-wait-input').forEach(inp => {
                inp.addEventListener('change', (e) => {
                    const scId = parseInt(e.target.dataset.scId);
                    const fIdx = parseInt(e.target.dataset.fieldIdx);
                    const sc = scenarios.find(s => s.id === scId);
                    if (sc && sc.fields[fIdx]) {
                        sc.fields[fIdx].waitAfter = Math.max(0, parseInt(e.target.value) || 0);
                    }
                });
            });

            // Wire reorder buttons
            tableWrap.querySelectorAll('.btn-order-up').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const scId = parseInt(e.target.dataset.scId);
                    const fIdx = parseInt(e.target.dataset.fieldIdx);
                    const sc = scenarios.find(s => s.id === scId);
                    if (sc && fIdx > 0) {
                        [sc.fields[fIdx - 1], sc.fields[fIdx]] = [sc.fields[fIdx], sc.fields[fIdx - 1]];
                        renderScenarios();
                    }
                });
            });
            tableWrap.querySelectorAll('.btn-order-down').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const scId = parseInt(e.target.dataset.scId);
                    const fIdx = parseInt(e.target.dataset.fieldIdx);
                    const sc = scenarios.find(s => s.id === scId);
                    if (sc && fIdx < sc.fields.length - 1) {
                        [sc.fields[fIdx], sc.fields[fIdx + 1]] = [sc.fields[fIdx + 1], sc.fields[fIdx]];
                        renderScenarios();
                    }
                });
            });
        });
    }
});
