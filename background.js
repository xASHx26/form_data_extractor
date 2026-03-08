// Background Service Worker — Coordinates picker flow between content script and panel window
let panelWindowId = null;

// Check if the panel window is still open
async function isPanelAlive() {
    if (!panelWindowId) return false;
    try {
        await chrome.windows.get(panelWindowId);
        return true;
    } catch {
        panelWindowId = null;
        return false;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Content script finished picking a section → open or update panel window
    if (request.action === 'pickerResult') {
        const scopeData = {
            pendingScope: request.data,
            targetTabId: sender.tab.id,
            targetTabUrl: sender.tab.url
        };

        chrome.storage.local.set(scopeData, async () => {
            const alive = await isPanelAlive();
            if (alive) {
                // Reuse existing panel — update URL to trigger reload with fresh data
                const tabs = await chrome.tabs.query({ windowId: panelWindowId });
                if (tabs[0]) {
                    await chrome.tabs.update(tabs[0].id, {
                        url: chrome.runtime.getURL('popup.html?mode=panel&t=' + Date.now())
                    });
                }
                chrome.windows.update(panelWindowId, { focused: true });
            } else {
                // Create new panel window
                const win = await chrome.windows.create({
                    url: chrome.runtime.getURL('popup.html?mode=panel'),
                    type: 'popup',
                    width: 520,
                    height: 720,
                    focused: true
                });
                panelWindowId = win.id;
            }
        });
        sendResponse({ success: true });
        return false;
    }

    // Picker was cancelled (ESC pressed) — clean up stored state
    if (request.action === 'pickerCancelled') {
        chrome.storage.local.remove(['pendingScope', 'targetTabId', 'targetTabUrl']);
        sendResponse({ success: true });
        return false;
    }
});

// Track panel window closing
chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === panelWindowId) {
        panelWindowId = null;
    }
});
