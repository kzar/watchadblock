"use strict";

//Firefox SDK modules
var { ToggleButton } = require('sdk/ui/button/toggle');
var panels = require("sdk/panel");
var tabs = require('sdk/tabs');
var data = require("sdk/self").data;
var cm = require("sdk/context-menu");

//AdBlock specific modules
var port_ff = require("port");
var functions = require("functions");
var background = require("background");
var BC = require("blockcounts");
var CP = require("contentpolicy");

//context menu
var adblockPageContextMenu = null;
var anyItem = null;
var specificItem = null;
var adblockImgContextMenu = null;
var anyImgItem = null;
var specificImgItem = null;

//used to keep track if browser is running, or being shutdown
var uiRunning = true;

//used to keep track if any UI wizards are currently open
var wizardOpen = false;

//OPTIONS PAGES SECTION
var openOptionsTab = function () {
    var localOptionsPageURL = "options/index.html";
    var optionTabWorker = null;
    var onReadyOptionsListener = function (tab) {
        if (data.url(localOptionsPageURL) === tab.url) {
            optionTabWorker = tab.attach({
                contentScriptFile: [
                    data.url("jquery/jquery-2.1.1.min.js"),
                    data.url("jquery/jquery-ui.min.js"),
                    data.url("cookie.js"),
                    data.url("cs_functions.js"),
                    data.url("cs_port.js"),
                    data.url("options/index.js"),
                    data.url("options/customize.js"),
                    data.url("options/filters.js"),
                    data.url("options/general.js"),
                    data.url("options/support.js")
                ],
            });
            port_ff.chrome.startListening(optionTabWorker);
        } else {
            tab.removeListener("ready", onReadyOptionsListener);
        }
    };
    var optionTab = tabs.open({
        url: data.url(localOptionsPageURL),
        onReady: onReadyOptionsListener
    });
};
exports.openOptionsTab = openOptionsTab;


//AdReport SECTION
var openAdReportTab = function (args) {
    var localAdReportPageURL = "pages/adreport.html";
    var adReportTabWorker = null;
    var onReadyAdReportListener = function (tab) {
        if (data.url(localAdReportPageURL) === tab.url) {
            adReportTabWorker = tab.attach({
                contentScript: 'var args = ' + args + ';',
                contentScriptFile: [
                    data.url("jquery/jquery-2.1.1.min.js"),
                    data.url("cs_functions.js"),
                    data.url("cs_port.js"),
                    data.url("pages/adreport.js")
                ],
            });
            port_ff.chrome.startListening(adReportTabWorker);
        } else {
            tab.removeListener("ready", onReadyAdReportListener);
        }
    };
    var optionTab = tabs.open({
        url: data.url(localAdReportPageURL),
        onReady: onReadyAdReportListener
    });
};
exports.openAdReportTab = openAdReportTab;

//ResourceBlock SECTION
var openResourceBlockTab = function (args) {
    var localResourceBlockPageURL = "pages/resourceblock.html";
    var resourceBlockTabWorker = null;
    var onReadyResourceBlockListener = function (tab) {
        if (tab.url.toString().indexOf(localResourceBlockPageURL) > 0) {
            resourceBlockTabWorker = tab.attach({
                contentScript: 'var args = ' + args + ';',
                contentScriptFile: [
                    data.url("jquery/jquery-2.1.1.min.js"),
                    data.url("jquery/jquery-ui.min.js"),
                    data.url("cs_functions.js"),
                    data.url("cs_port.js"),
                    data.url("pages/resourceblock.js")
                ],
            });
            port_ff.chrome.startListening(resourceBlockTabWorker);
        } else {
            tab.removeListener("ready", onReadyResourceBlockListener);
        }
    };
    var optionTab = tabs.open({
        url: data.url(localResourceBlockPageURL),
        onReady: onReadyResourceBlockListener
    });
};
exports.openResourceBlockTab = openResourceBlockTab;

//LaunchSubscribe SECTION
var subscribePanel = null;
var openSubscribePanel = function (args) {

    subscribePanel = require("sdk/panel").Panel({
        width: 450,
        height: 200,
        contentScriptFile: [
            data.url("jquery/jquery-2.1.1.min.js"),
            data.url("cs_functions.js"),
            data.url("cs_port.js"),
            data.url("pages/subscribe.js")
        ],
        contentScriptWhen: "start",
        contentScriptOptions: args,
        contentURL: data.url('pages/subscribe.html')
    }).show();

    subscribePanel.port.on("call", function (request) {

        var fn = background[request.fn];
        if (typeof fn === 'undefined') {
            fn = exports[request.fn];
        }
        if (typeof fn === 'undefined') {
            functions.logging.log("subscribePanel - called function", request.fn, "but it was not found");
            return;
        }
        var sender = {};
        sender.tab = tabs.activeTab;
        request.args.push(sender);
        var result = fn.apply(null, request.args);

        if (result !== 'undefined') {
            if (typeof request.uniqueID === 'undefined') {
                subscribePanel.port.emit('call', result);
            } else {
                subscribePanel.port.emit(('call' + request.uniqueID), result);
            }
        }
    });

    subscribePanel.port.on("close", function () {
        subscribePanel.hide();
    });

    port_ff.chrome.extension.onRequest.addListener(function (request) {
        subscribePanel.port.emit(request.command, request);
    });
};
exports.openSubscribePanel = openSubscribePanel;


//ADBLOCK BUTTON / POPUP
const defaultState = {
    "label": "AdBlock",
    icon: {
        "16": "./img/icon16.png",
        "32": "./img/icon32.png",
        "64": "./img/icon64.png"
    },
};

const whitelistedState = {
    "label": "Whitelisted Site",
    icon: {
        "16": "./img/icon16-whitelisted.png",
        "32": "./img/icon32-whitelisted.png",
        "64": "./img/icon64-whitelisted.png"
    },
    badge: "",
};

const pauseState = {
    "label": "AdBlock Paused",
    icon: {
        "16": "./img/icon16-grayscale.png",
        "32": "./img/icon32-grayscale.png",
        "64": "./img/icon64-grayscale.png"
    },
    badge: "",
};

var adblockButton = ToggleButton({
    id: "adblock-link",
    label: "AdBlock",
    icon: {
        "16": "./img/icon16.png",
        "32": "./img/icon32.png",
        "64": "./img/icon64.png"
    },
    badge: "",
    badgeColor: "#555",
    onChange: handleButtonChange,
    onClick: updateButtonUIAndContextMenus
});

var buttonPanel = panels.Panel({
    contentURL: data.url("button/popup.html"),
    onHide: handleButtonPanelHide
});

buttonPanel.port.on("call", function (request) {
    var fn = background[request.fn];
    if (typeof fn === 'undefined') {
        fn = exports[request.fn];
    }
    if (typeof fn === 'undefined') {
        functions.logging.log("button JavaScript - called function", request.fn, "but it was not found");
        return;
    }
    var sender = {};
    sender.tab = tabs.activeTab;
    request.args.push(sender);
    var result = fn.apply(null, request.args);

    if (result !== 'undefined') {
        if (typeof request.uniqueID === 'undefined') {
            buttonPanel.port.emit('call', result);
        } else {
            buttonPanel.port.emit(('call' + request.uniqueID), result);
        }
    }
});

buttonPanel.port.on("resizePopup", function (dimensions) {
    buttonPanel.resize(dimensions.width, dimensions.height);
});

buttonPanel.port.on("close", function () {
    buttonPanel.hide();
});

buttonPanel.port.on("openExternalTab", function (url) {
    tabs.open(url);
});

function handleButtonChange(state) {
    if (state.checked) {
        if (tabs.activeTab && tabs.activeTab.url) {

            var total_blocked = BC.blockCounts.getTotalAdsBlocked();
            if (tabs && typeof tabs.activeTab !== 'undefined') {
                var tab_blocked = BC.blockCounts.getTotalAdsBlocked(tabs.activeTab.id);
                if (!tab_blocked)
                    tab_blocked = "0";
            } else {
                var tab_blocked = "0";
            }
            var adblock_is_paused = background.adblock_is_paused();
            var page_is_unblockable = background.page_is_unblockable(tabs.activeTab.url);
            var displayStats = background.get_settings().display_stats;
            var display_menu_stats = background.get_settings().display_menu_stats;
            var show_advanced_options = background.get_settings().show_advanced_options;
            var ytWhitelist = background.get_settings().youtube_channel_whitelist;
            var settings = background.get_settings();

            var popupOptions = {
                tab: {
                    url: tabs.activeTab.url,
                    id: tabs.activeTab.id
                },
                adblock_is_paused: adblock_is_paused,
                disabled_site: page_is_unblockable,
                total_blocked: total_blocked,
                tab_blocked: tab_blocked,
                display_stats: displayStats,
                display_menu_stats: display_menu_stats,
                show_advanced_options: show_advanced_options,
                youtube_channel_whitelist: ytWhitelist,
                settings: settings
            };
            if (!page_is_unblockable)
                popupOptions.whitelisted = CP.page_is_whitelisted(tabs.activeTab.url);

        } else {
            var tabURL = "";
            var total_blocked = BC.blockCounts.getTotalAdsBlocked();
            var tab_blocked = "0";
            var adblock_is_paused = background.adblock_is_paused();
            var page_is_unblockable = "";
            var displayStats = background.get_settings().display_stats;
            var display_menu_stats = background.get_settings().display_menu_stats;
            var show_advanced_options = background.get_settings().show_advanced_options;
            var ytWhitelist = background.get_settings().youtube_channel_whitelist;
            var settings = background.get_settings();

            var popupOptions = {
                tab_url: tabURL,
                adblock_is_paused: adblock_is_paused,
                disabled_site: page_is_unblockable,
                total_blocked: total_blocked,
                tab_blocked: tab_blocked,
                display_stats: displayStats,
                display_menu_stats: display_menu_stats,
                show_advanced_options: show_advanced_options,
                youtube_channel_whitelist: ytWhitelist,
                settings: settings
            };
        }
        buttonPanel.port.emit("update_content", popupOptions);
        buttonPanel.show({
            position: adblockButton
        });
    }
}

function handleButtonPanelHide() {
    adblockButton.state('window', {checked: false});
}
//Set the number of ads blocked for the tabId (if enabled).
//Only works in Firefox v.36+, but doesn't give an error in previous versions.
//On single page sites, the number of ads blocked will continue to increase
//even when the address / URL is updated because a new page isn't being loaded, the URL is
//usually updated using the History API.
function updateBadge(count) {
    if (!background.get_settings().display_stats ||
        !count) {
        defaultState.badge = "";
    } else if (count > 0) {
        defaultState.badge = count;
    }

    adblockButton.state("tab", defaultState);
}
exports.updateBadge = updateBadge;

function updateButtonUIAndContextMenus() {
    if (!uiRunning) {
        return;
    }
    if (tabs === undefined ||
        tabs.activeTab === undefined ||
        tabs.activeTab.url === undefined) {
        //if there isn't an active Tab, or an active tab URL, just return to avoid errors
        //this could happend when a tab or window is closing
        return;
    }
    if (background.adblock_is_paused()) {
        adblockButton.state(tabs.activeTab, pauseState);
    } else if (CP.page_is_whitelisted(tabs.activeTab.url)) {
        adblockButton.state(tabs.activeTab, whitelistedState);
    } else {
        updateBadge(BC.blockCounts.getTotalAdsBlocked(tabs.activeTab.id));
    }
    setContextMenus(background.getCurrentTabInfo());
};
exports.updateButtonUIAndContextMenus = updateButtonUIAndContextMenus;

var destroy = function (args) {
    uiRunning = false;
    if (subscribePanel)
        subscribePanel.destroy();
};
exports.destroy = destroy;

function emit_page_broadcast(request) {
    // Inject the required scripts to execute fn_name(parameter) in
    // the tabId.
    // Inputs: fn_name:string name of function to execute on tab.
    //         fn_name must exist in switch statement below.
    //         parameter:object to pass to fn_name.  Must be JSON.stringify()able.


    var tabToInject = tabs.activeTab;
    var contextWorker = null;
    switch (request.fn) {
        case "top_open_whitelist_ui":
            //if a wizard is already open, return, don't open another one.
            if (wizardOpen)
                return;
            wizardOpen = true;
            var contextWorker = tabToInject.attach({
                contentScriptFile: [
                    data.url("jquery/jquery-2.1.1.min.js"),
                    data.url("jquery/jquery-ui.min.js"),
                    data.url("cs_port.js"),
                    data.url("cs_functions.js"),
                    data.url("uiscripts/load_css.js"),
                    data.url("uiscripts/top_open_whitelist_ui.js"),
                    data.url("uiscripts/firefox_hooks.js"),
                ],
            });
            break;
        case "send_content_to_back":
            var contextWorker = tabToInject.attach({
                contentScriptFile: [
                    data.url("cs_port.js"),
                    data.url("cs_functions.js"),
                    data.url("uiscripts/send_content_to_back.js"),
                    data.url("uiscripts/firefox_hooks.js"),
                ],
            });
            break;
        case "top_open_blacklist_ui":
            if (wizardOpen)
                return;
            wizardOpen = true;
            var contextWorker = tabToInject.attach({
                contentScriptFile: [
                    data.url("jquery/jquery-2.1.1.min.js"),
                    data.url("jquery/jquery-ui.min.js"),
                    data.url("cs_port.js"),
                    data.url("cs_functions.js"),
                    data.url("uiscripts/load_css.js"),
                    data.url("uiscripts/blacklisting/overlay.js"),
                    data.url("uiscripts/blacklisting/clickwatcher.js"),
                    data.url("uiscripts/blacklisting/elementchain.js"),
                    data.url("uiscripts/blacklisting/blacklistui.js"),
                    data.url("uiscripts/top_open_blacklist_ui.js"),
                    data.url("uiscripts/firefox_hooks.js"),
                ],
            });
            break;
        default:
            functions.logging.log("uiwidget.js::emit_page_broadcast function not found", request.fn);
            return;
    }
    port_ff.chrome.startListening(contextWorker);
    //now emit a call to the injected scripts to run.
    contextWorker.port.emit("call", request);
    contextWorker.port.on("wizardClosing", function () {
        wizardOpen = false;
    });
};
exports.emit_page_broadcast = emit_page_broadcast;

//Add the context menu(s) to the page (if needed)
var setContextMenus = function (info) {

    if (specificItem)
        specificItem.destroy();

    if (anyItem)
        anyItem.destroy();

    if (adblockPageContextMenu)
        adblockPageContextMenu.destroy();

    if (specificImgItem)
        specificItem.destroy();

    if (anyImgItem)
        anyItem.destroy();

    if (adblockImgContextMenu)
        adblockImgContextMenu.destroy();

    if (!background.get_settings().show_context_menu_items) {
        return;
    }

    if (!info ||
        background.adblock_is_paused() ||
        info.whitelisted ||
        info.disabled_site) {
        return;
    }

    specificItem = cm.Item({
        label: port_ff.chrome.i18n.getMessage("block_this_ad"),
        contentScriptFile: data.url("uiscripts/blacklisting/context_menu_script.js"),
        onMessage: function (dataId) {
            emit_page_broadcast(
                {fn: 'top_open_blacklist_ui', options: {id: dataId}},
                {tab: tabs.activeTab}
            );
        }
    });

    anyItem = cm.Item({
        label: port_ff.chrome.i18n.getMessage("block_an_ad_on_this_page"),
        contentScriptFile: data.url("uiscripts/blacklisting/context_menu_script.js"),
        onMessage: function (dataId) {
            emit_page_broadcast(
                {fn: 'top_open_blacklist_ui', options: {nothing_clicked: true}},
                {tab: tabs.activeTab}
            );
        }
    });

    adblockPageContextMenu = cm.Menu({
        label: "AdBlock",
        image: data.url("img/icon16.png"),
        context: cm.PageContext(),
        items: [anyItem, specificItem]
    });

    specificImgItem = cm.Item({
        label: port_ff.chrome.i18n.getMessage("block_this_ad"),
        contentScriptFile: data.url("uiscripts/blacklisting/context_menu_script.js"),
        onMessage: function (dataId) {
            emit_page_broadcast(
                {fn: 'top_open_blacklist_ui', options: {id: dataId}},
                {tab: tabs.activeTab}
            );
        }
    });

    anyImgItem = cm.Item({
        label: port_ff.chrome.i18n.getMessage("block_an_ad_on_this_page"),
        contentScriptFile: data.url("uiscripts/blacklisting/context_menu_script.js"),
        onMessage: function (dataId) {
            emit_page_broadcast(
                {fn: 'top_open_blacklist_ui', options: {nothing_clicked: true}},
                {tab: tabs.activeTab}
            );
        }
    });

    adblockImgContextMenu = cm.Menu({
        label: "AdBlock",
        image: data.url("img/icon16.png"),
        context: cm.SelectorContext("img"),
        items: [anyImgItem, specificImgItem]
    });
};