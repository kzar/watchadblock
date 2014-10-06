emit_page_broadcast = function(request) {
    safari.application.activeBrowserWindow.activeTab.page.dispatchMessage('page-broadcast', request);
};

// True blocking support.
safari.application.addEventListener("message", function(messageEvent) {
    if (messageEvent.name != "canLoad")
        return;

    var tab = messageEvent.target;
    var frameInfo = messageEvent.message.frameInfo;
    chrome._tabInfo.notice(tab, frameInfo);
    var sendingTab = chrome._tabInfo.info(tab, frameInfo.visible);

    if (adblock_is_paused() || page_is_unblockable(sendingTab.url) ||
        page_is_whitelisted(sendingTab.url)) {
        messageEvent.message = true;
        return;
    }

    var url = messageEvent.message.url;
    var elType = messageEvent.message.elType;
    var frameDomain = messageEvent.message.frameDomain;

    var isMatched = url && (_myfilters.blocking.matches(url, elType, frameDomain));
    if (isMatched)
        log("SAFARI TRUE BLOCK " + url + ": " + isMatched);
    messageEvent.message = !isMatched;
}, false);

// Code for creating popover, not available on Safari 5.0
var ABPopover = safari.extension.createPopover("AdBlock", safari.extension.baseURI + "button/popup.html");

function setPopover(popover) {
    for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
        safari.extension.toolbarItems[i].popover = popover;
        var toolbarItem = safari.extension.toolbarItems[i];
        toolbarItem.popover = popover;
        toolbarItem.toolTip = "AdBlock"; // change the tooltip on Safari 5.1+
        toolbarItem.command = null;
    }
}

// Code for removing popover
function removePopover(popover) {
    safari.extension.removePopover(popover);
}

// Reload popover when opening/activating tab, or URL was changed
safari.application.addEventListener("activate", function(event) {
    if (event.target instanceof SafariBrowserTab) {
        safari.extension.popovers[0].contentWindow.location.reload();
        // Hide popover, when new tab has been opened
        if (ABPopover.visible)
            ABPopover.hide();
    }
}, true);

safari.application.addEventListener("popover", function(event) {
    safari.extension.popovers[0].contentWindow.location.reload();
}, true);

safari.application.addEventListener("validate", function(event) {
    if (event.target instanceof SafariExtensionToolbarItem) {
        var item = event.target;
            if (item.browserWindow && !item.popover) {
                // Check if only this item lacks a popover (which means user just opened a new window) or there are multiple items
                // lacking a popover (which only happens on browser startup or when the user removes AdBlock toolbar item and later
                // drags it back).
                var uninitializedItems = 0;
                for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
                    var item = safari.extension.toolbarItems[i];
                    if (!item.popover) {
                        uninitializedItems++;
                    }
                }
                if (uninitializedItems > 1) {
                    // Browser startup or toolbar item added back to the toolbar. To prevent memory leaks in the second case,
                    // we need to remove all previously created popovers.
                    for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
                        removePopover(ABPopover);
                    }
                    // And now recreate the popover for toolbar items in all windows.
                    setPopover(ABPopover);
                } else {
                    // New window has been opened, create popover for it
                    setPopover(ABPopover);
                }
            }
    }
}, true);

// Remove the popover when the window closes so we don't leak memory.
safari.application.addEventListener("close", function(event) {
    if (event.target instanceof SafariBrowserWindow) { // don't handle tabs
        for (var i = 0; i < safari.extension.toolbarItems.length; i++) {
            var item = safari.extension.toolbarItems[i];
            if (item.browserWindow === event.target) {
                var popover = item.popover;

                // Safari docs say that we must detach popover from toolbar items before removing.
                item.popover = null;

                // Remove the popover.
                removePopover(ABPopover);
                break;
            }
        }
    }
}, true);

// Set commands for whitelist, blacklist and undo my blocks wizards
safari.application.addEventListener("command", function(event) {
    var browserWindow;
    if (event.target.browserWindow) {
        // Context menu item event or button event on Safari 5.0, browserWindow is available in event.target.
        browserWindow = event.target.browserWindow;
    } else {
        // browserWindow is not available in event.target for context menu item events in Safari 5.1.
        browserWindow = safari.application.activeBrowserWindow;
    }
    var command = event.command;

    if (command in {"show-whitelist-wizard": 1, "show-blacklist-wizard": 1, "show-clickwatcher-ui": 1 }) {
        browserWindow.activeTab.page.dispatchMessage(command);
    }
}, false);

var dispatchMessage = function(command) {
    safari.application.activeBrowserWindow.activeTab.page.dispatchMessage(command);
};

// Open Options page upon settings checkbox click.
safari.extension.settings.openAdBlockOptions = false;
safari.extension.settings.addEventListener("change", function(e) {
    if (e.key == 'openAdBlockOptions')
        openTab("options/index.html");
}, false);

// Add context menus
safari.application.addEventListener("contextmenu", function(event) {
    if (!event.userInfo)
        return;
    if (!get_settings().show_context_menu_items || adblock_is_paused())
        return;

    var url = event.target.url;
    if (page_is_unblockable(url) || page_is_whitelisted(url))
        return;

    event.contextMenu.appendContextMenuItem("show-blacklist-wizard", translate("block_this_ad"));
    event.contextMenu.appendContextMenuItem("show-clickwatcher-ui", translate("block_an_ad_on_this_page"));

    var host = parseUri(url).host;
    if (count_cache.getCustomFilterCount(host) && !LEGACY_SAFARI)
        event.contextMenu.appendContextMenuItem("undo-last-block", translate("undo_last_block"));
}, false);