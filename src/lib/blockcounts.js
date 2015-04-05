"use strict";

var functions = require("functions");
var tabs = require('sdk/tabs');
var tabUtils = require('sdk/tabs/utils');

exports.blockCounts = (function () {
    var key = "blockage_stats";
    var data = functions.storage_get(key);
    if (!data)
        data = {};
    if (data.start === undefined)
        data.start = Date.now();
    if (data.total === undefined)
        data.total = 0;
    data.version = 1;
    functions.storage_set(key, data);

    return {
        recordOneAdBlocked: function (tabId) {
            var data = functions.storage_get(key);
            data.total += 1;
            functions.storage_set(key, data);

            //code for incrementing ad blocks
            var currentTab = tabUtils.getTabForId(tabId);
            if (currentTab) {
                if (!("_getadblock_com_blockcount" in currentTab)) {
                    currentTab._getadblock_com_blockcount = 0;
                }
                currentTab._getadblock_com_blockcount++;
                if (tabId === tabs.activeTab.id) {
                    require("uiwidgets").updateBadge(currentTab._getadblock_com_blockcount);
                }
            }
        },
        get: function () {
            return functions.storage_get(key);
        },
        getTotalAdsBlocked: function (tabId) {
            if (tabId) {
                var currentTab = tabUtils.getTabForId(tabId);
                return currentTab ? currentTab._getadblock_com_blockcount : 0;
            }
            return this.get().total;
        }
    };
})();