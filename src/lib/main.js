"use strict";

var tabUtils = require('sdk/tabs/utils');
var tabs = require('sdk/tabs');
var pageMods = require("sdk/page-mod");
var data = require("sdk/self").data;
var self = require("sdk/self");

//AdBlock specific modules
var port_ff = require("port");
var functions = require("functions");
var CP = require("contentpolicy");
var background = require("background");
var STATS = require("stats");

if (!functions.isFennec()) {
    var UI = require("uiwidgets");
}

exports.main = function (options, callbacks) {
    init();
    if (options && options.loadReason === 'install') {
        //moved from background to here
        var url = "https://getadblock.com/installed/?u=" + STATS.STATS.userId;
        //need to wait a bit, so that all of the web calls
        //are processed by the ContentPolicy impl
        var openTabToGetAdBlock = function () {
            tabs.open(url);
        };
        require('sdk/timers').setTimeout(openTabToGetAdBlock, 200);
    }

};

//
exports.onUnload = function (reason) {

    if (!functions.isFennec()) {
        UI.destroy();
        tabs.removeListener("open", onTabOpen);
        tabs.removeListener("activate", tabActivate);
        tabs.removeListener("pageshow", tabActivate);
        port_ff.chrome.i18n.destroy();
    }
    background.removeMalwareNotifications();
    port_ff.chrome.extension.destroy();
};

function init() {

    var pageMod = pageMods.PageMod({
        include: ['*'],
        contentScriptWhen: 'start',
        attachTo: ["existing", "top"],
        contentScriptFile: [
            data.url("cs_port.js"),
            data.url("cs_functions.js"),
            data.url("bandaids.js"),
            data.url("adblock_start_common.js"),
            data.url("adblock_start_firefox.js")
        ],
        onAttach: port_ff.chrome.startListening
    });

    if (!functions.isFennec()) {
        //set up tab listeners
        tabs.on('open', onTabOpen);
        tabs.on("activate", tabActivate);
        tabs.on("pageshow", tabActivate);
        port_ff.chrome.i18n.initializeL10nData();
    }

}//end of init()


function onTabOpen(tab) {
    if (tab && tab.id) {
        var newTab = tabUtils.getTabForId(tab.id);
        if (newTab) {
            if ("_getadblock_com_blockcount" in newTab) {
                newTab._getadblock_com_blockcount = 0;
            }
            if ("_getadblock_com_resources" in newTab) {
                delete tab._getadblock_com_resources;
            }
            if (functions.isHttpUri(newTab.url)) {
                var isWhitelisted = CP.page_is_whitelisted(newTab.url.spec);
                newTab._getadblock_com_isWhitelisted = isWhitelisted;
            } else {
                newTab._getadblock_com_isWhitelisted = null;
            }
        }
    }
}

function tabActivate(tab) {
    if (tab &&
        tab.url &&
        background.get_settings().youtube_channel_whitelist &&
        functions.parseUri(tab.url).host === "www.youtube.com") {

        tab.attach({
            contentScriptFile: data.url("ytchannel.js")
        });
    }
    UI.updateButtonUIAndContextMenus();
}