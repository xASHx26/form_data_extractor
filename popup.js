// Popup UI Logic
document.addEventListener('DOMContentLoaded', function () {
    const extractBtn = document.getElementById('extractBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportDemoBtn = document.getElementById('exportDemoBtn');
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const customNameInput = document.getElementById('customName');
    const saveNameBtn = document.getElementById('saveNameBtn');
    const cacheInfo = document.getElementById('cacheInfo');
    const cacheText = document.getElementById('cacheText');
    const refreshBtn = document.getElementById('refreshBtn');

    let currentData = null;
    let currentUrl = '';
    let isLoadedFromCache = false;

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
            emptyState.classList.add('hidden');
        }
    }

    // Refresh button - force re-extraction
    refreshBtn.addEventListener('click', () => {
        hideCacheInfo();
        extractBtn.click();
    });

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

    // Load saved name and cached data on init
    loadSavedName();
    autoLoadCache();

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
        showStatus('Analyzing page...', false);
        hideCacheInfo(); // Hide cache banner when extracting fresh

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentUrl = tab.url;

            // Load saved name for this URL
            chrome.storage.local.get([currentUrl], (result) => {
                if (result[currentUrl]) {
                    customNameInput.value = result[currentUrl];
                }
            });

            // Inject content script and execute extraction
            chrome.tabs.sendMessage(tab.id, { action: 'extractForms' }, (response) => {
                if (chrome.runtime.lastError) {
                    showStatus('Error: ' + chrome.runtime.lastError.message, true);
                    extractBtn.disabled = false;
                    extractBtn.innerHTML = '<span class="icon">⚡</span> Extract Forms';
                    return;
                }

                if (response && response.success) {
                    currentData = response.data;
                    displayData(currentData);
                    showStatus(`Extracted ${currentData.metadata.totalElements} elements from ${currentData.metadata.totalForms} form(s)`, false);

                    // Cache the extracted data
                    cacheFormData(currentUrl, currentData);

                    // Enable all export buttons
                    exportBtn.disabled = false;
                    exportCsvBtn.disabled = false;
                    exportDemoBtn.disabled = false;
                    emptyState.classList.add('hidden');
                } else {
                    showStatus('Error: ' + (response?.error || 'Unknown error'), true);
                }

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

        const formsList = document.getElementById('formsList');
        formsList.innerHTML = '';

        data.forms.forEach(form => {
            const formCard = createFormCard(form);
            formsList.appendChild(formCard);
        });
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

        if (data.elements.length === 0) {
            elementsList.innerHTML = '<p style="text-align: center; color: #6c757d;">No elements found</p>';
            return;
        }

        data.elements.forEach(element => {
            const card = createElementCard(element);
            elementsList.appendChild(card);
        });
    }

    // Create element card
    function createElementCard(element) {
        const card = document.createElement('div');
        card.className = 'element-card';

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

        // Format React selectors
        let reactSelectorsHtml = '';
        if (element.reactSelectors) {
            const react = element.reactSelectors;
            const reactParts = [];

            if (react.testId) reactParts.push(`<div><strong>TestID:</strong> ${escapeHtml(react.testId)}</div>`);
            if (react.role) reactParts.push(`<div><strong>Role:</strong> ${escapeHtml(react.role)}</div>`);
            if (react.labelText) reactParts.push(`<div><strong>Label:</strong> ${escapeHtml(react.labelText)}</div>`);
            if (react.placeholderText) reactParts.push(`<div><strong>Placeholder:</strong> ${escapeHtml(react.placeholderText)}</div>`);
            if (react.text) reactParts.push(`<div><strong>Text:</strong> ${escapeHtml(react.text)}</div>`);

            if (reactParts.length > 0) {
                reactSelectorsHtml = `
                    <div class="detail-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e9ecef;">
                        <div style="font-weight: 600; color: #667eea; margin-bottom: 4px; font-size: 11px;">⚛️ REACT SELECTORS</div>
                        <div style="font-size: 10px; line-height: 1.5;">${reactParts.join('')}</div>
                    </div>
                `;
            }
        }

        card.innerHTML = `
      <div class="element-header">
        <span class="element-type ${typeClass}">${element.type}</span>
        <button class="copy-btn" data-xpath="${escapeHtml(element.xpath)}">Copy XPath</button>
      </div>
      <div class="element-details">
        ${element.id ? `<div class="detail-row"><span class="detail-label">ID:</span><span class="detail-value">${escapeHtml(element.id)}</span></div>` : ''}
        ${element.name ? `<div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${escapeHtml(element.name)}</span></div>` : ''}
        ${element.label ? `<div class="detail-row"><span class="detail-label">Label:</span><span class="detail-value">${escapeHtml(element.label)}</span></div>` : ''}
        ${element.placeholder ? `<div class="detail-row"><span class="detail-label">Placeholder:</span><span class="detail-value">${escapeHtml(element.placeholder)}</span></div>` : ''}
        ${optionsHtml}
        ${groupOptionsHtml}
        <div class="detail-row">
          <span class="detail-label">XPath:</span>
          <span class="detail-value">${escapeHtml(element.xpath)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">CSS:</span>
          <span class="detail-value">${escapeHtml(element.cssSelector)}</span>
        </div>
        ${reactSelectorsHtml}
        ${element.required ? '<div style="color: #dc3545; font-size: 11px;">⚠ Required</div>' : ''}
        ${element.disabled ? '<div style="color: #6c757d; font-size: 11px;">🚫 Disabled</div>' : ''}
      </div>
    `;

        // Add copy functionality
        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            const xpath = copyBtn.dataset.xpath;
            navigator.clipboard.writeText(xpath).then(() => {
                copyBtn.textContent = '✓ Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy XPath';
                }, 2000);
            });
        });

        return card;
    }

    // Display dependencies tab
    function displayDependencies(data) {
        const dependenciesList = document.getElementById('dependenciesList');
        dependenciesList.innerHTML = '';

        if (data.dependencies.length === 0) {
            dependenciesList.innerHTML = '<p style="text-align: center; color: #6c757d;">No dependencies detected</p>';
            return;
        }

        data.dependencies.forEach((dep, index) => {
            const card = createDependencyCard(dep, index);
            dependenciesList.appendChild(card);
        });
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

        card.innerHTML = `
      <div class="dependency-title">
        ${typeEmoji[dependency.type] || '🔗'} ${dependency.type.toUpperCase()}
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
});
