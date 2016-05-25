'use strict';

import { Tablist, Tab } from './models';
import { SUSPEND_AFTER_MINS_DEFAULT } from './constants.js';

// chrome.runtime.getBackgroundPage pulls in the window object
window.list = new Tablist();

function onTabUpdated (attrs) {
	if (attrs.title === "New Tab") return false;

	if (!list.get(attrs.id)) {
		list.create(attrs);
	}
	else if (list.get(attrs.id)) {
		list.update(attrs);
	}
}

chrome.tabs.onHighlighted.addListener((info) => {
	$.each(info.tabIds, (index, tabId) => {
		chrome.tabs.get(tabId, (tab) => {
			if (chrome.runtime.lastError) return false;
			onTabUpdated(tab);
		});
	});
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
	if (change.status !== "loading") {
		onTabUpdated(tab);
	}
});

chrome.tabs.onActivated.addListener((activeInfo) => {
	chrome.tabs.get(activeInfo.tabId, (tab) => {
		if (chrome.runtime.lastError) return false;
		onTabUpdated(tab);
	});

	list.prevActiveTab().add(activeInfo.tabId);

	setTimeout(() => {
		let tab = list.prevActiveTab().get();
		if (tab) {
			list.set(tab.get('id'), { 'updated': new Date() });
		}
	}, 600);
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
	list.remove(removedTabId);
	chrome.tabs.get(addedTabId, (tab) => {
		onTabUpdated(tab);
	});
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
	if (chrome.runtime.lastError) return false;
	var tab = list.get(tabId);
	if (tab && !tab.get('suspended')) {
		list.remove(tabId);
	}
});

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (changes.suspendAfterMins) {
		list.settings.suspendAfterMins = changes.suspendAfterMins.newValue;
	}

	if (changes.whitelist) {
		list.settings.whitelist = changes.whitelist.newValue;
	}
});

chrome.storage.sync.get('suspendAfterMins', (items) => {
	list.settings.suspendAfterMins = (items.suspendAfterMins || SUSPEND_AFTER_MINS_DEFAULT);
});

chrome.storage.sync.get('whitelist', (items) => {
	list.settings.whitelist = (items.whitelist || []);
});

chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason === "install") {
		chrome.tabs.query({}, (tabs) => {
			$.each(tabs, (count, tab) => {
				onTabUpdated(tab);
			});
		});
	}
});

chrome.windows.onRemoved.addListener(function (windowId) {
	chrome.tabs.query({ currentWindow: true, active: true }, (queryTabs) => {
		$.each(list.tabs, (count, tab) => {
			if (!tab) return;
			if (tab.get('windowId') === windowId) {
				list.remove(tab.get('id'));
			}
		});
	});
});


