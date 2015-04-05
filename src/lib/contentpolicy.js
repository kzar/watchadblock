'use strict';

const {Cc, Ci, Cr, Cu, Cm, components} = require("chrome");
const { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
var unload = require("sdk/system/unload");
var xpcom = require('sdk/platform/xpcom');
var { Class }   = require('sdk/core/heritage');

var tabUtils = require('sdk/tabs/utils');

var functions = require("functions");
var port = require("port");
var background = require("background");
var MY = require("myfilters");
var BC = require("blockcounts");

//Load & Initialize the filters...
var _myFilters = new MY.MyFilters();
_myFilters.init();
exports._myFilters = _myFilters;
exports.MY = MY;

//
// com.getadblock namespace.
//
if (typeof com === "undefined")
    var com = {};
if (typeof com.getadblock === "undefined")
    com.getadblock = {};

if (typeof com.getadblock.xpcom_categories === "undefined")
    com.getadblock.xpcom_categories = {};
com.getadblock.xpcom_categories = "content-policy";

if (typeof com.getadblock.contractID === "undefined")
    com.getadblock.contractID = {};
com.getadblock.contractID = "@com.getadblock/contentpolicy;1";

if (typeof com.getadblock.policy === "undefined")
    com.getadblock.policy = {};
com.getadblock.policy = Class({
    extends: xpcom.Unknown,
    interfaces: ['nsIContentPolicy'],
    get wrappedJSObject() this,
    classDescription: "com.getadblock content policy",
    classID: components.ID("{2DA54ECA-FBDD-11E3-B3B1-695C1D5D46B0}"),

    // nsIContentPolicy interface implementation
    shouldLoad: function (aContentType,
                          aContentLocation,
                          aRequestOrigin,
                          aContext,
                          aMimeTypeGuess,
                          aExtra,
                          aRequestPrincipal) {
        if (background.adblock_is_paused())
            return Ci.nsIContentPolicy.ACCEPT;

        if (!aContext || !functions.isHttpUri(aContentLocation))
            return Ci.nsIContentPolicy.ACCEPT;

        if (aContentType === Ci.nsIContentPolicy.TYPE_DOCUMENT)
            return Ci.nsIContentPolicy.ACCEPT;

        if (aContext instanceof components.interfaces.nsIDOMNode) {
            var node = aContext.QueryInterface(components.interfaces.nsIDOMNode);
            var contentWin = functions.getWindow(node);
            if (contentWin) {
                var selectedTab = tabUtils.getTabForContentWindow(contentWin);
                if (selectedTab) {
                    var tabId = tabUtils.getTabId(selectedTab);
                    var tabURL = tabUtils.getTabURL(selectedTab);
                }
                var elType = MY.ElementTypes.convertFireFoxContentType(aContentType, (node || {}));
                if (selectedTab) {

                    if ("_getadblock_com_isWhitelisted" in selectedTab &&
                        selectedTab._getadblock_com_isWhitelisted) {
                        return Ci.nsIContentPolicy.ACCEPT;
                    }

                    if ((!("_getadblock_com_isWhitelisted" in selectedTab)) ||
                        (selectedTab._getadblock_com_isWhitelisted === null)) {
                        var isWhitelisted = page_is_whitelisted(tabURL);
                        isWhitelisted = isWhitelisted ? true : false;
                        selectedTab._getadblock_com_isWhitelisted = isWhitelisted;

                        if (isWhitelisted && (!functions.isFennec()))
                            require("uiwidgets").updateButtonUIAndContextMenus();
                    }

                    //if advance user is set, save the resources on the tab
                    if (background.get_settings().show_advanced_options) {
                        if (!("_getadblock_com_resources" in selectedTab)) {
                            selectedTab._getadblock_com_resources = {};
                        }
                        if (!(selectedTab._getadblock_com_resources[0])) {
                            selectedTab._getadblock_com_resources[0] = {};
                            selectedTab._getadblock_com_resources[0].domain = aRequestOrigin.host;
                            selectedTab._getadblock_com_resources[0].url = aContentLocation.spec;
                            selectedTab._getadblock_com_resources[0].resources = {};
                        }
                        //contentWin.frameElement will have a reference to iframe / frame, etc.
                        //we use this to detect if the element is in a frame, to correctly to store
                        //the frame info.
                        if (contentWin.frameElement) {
                            //aRequestOrigin.host frame data
                            if (aRequestOrigin.host && selectedTab._getadblock_com_resources[aRequestOrigin.host])
                                selectedTab._getadblock_com_resources[aRequestOrigin.host].resources[(elType + ':|:' + aContentLocation.spec)] = "";
                            else {
                                selectedTab._getadblock_com_resources[aRequestOrigin.host] = {};
                                selectedTab._getadblock_com_resources[aRequestOrigin.host].domain = aRequestOrigin.host;
                                selectedTab._getadblock_com_resources[aRequestOrigin.host].url = aContentLocation.spec;
                                selectedTab._getadblock_com_resources[aRequestOrigin.host].resources = {};
                                selectedTab._getadblock_com_resources[aRequestOrigin.host].resources[(elType + ':|:' + aContentLocation.spec)] = "";
                            }
                        } else {
                            //frame zero / 0
                            selectedTab._getadblock_com_resources[0].resources[(elType + ':|:' + aContentLocation.spec)] = "";
                        }
                        //we should process the frame / sub-document first, before any elements in that frame,
                        //set up the neccessary infor for that frame.
                        if (Ci.nsIContentPolicy.TYPE_SUBDOCUMENT === aContentType) {
                            selectedTab._getadblock_com_resources[aContentLocation.host] = {};
                            selectedTab._getadblock_com_resources[aContentLocation.host].domain = aContentLocation.host;
                            selectedTab._getadblock_com_resources[aContentLocation.host].url = aContentLocation.spec;
                            selectedTab._getadblock_com_resources[aContentLocation.host].resources = {};
                        }
                    }

                    var blocked = _myFilters.blocking.matches(aContentLocation.spec, elType, aRequestOrigin.host);

                    if (blocked && (!functions.isFennec())) {
                        if (!("_getadblock_com_blocked_url" in selectedTab)) {
                            selectedTab._getadblock_com_blocked_url = {};
                        }
                        //Update the counts for this tab, but only
                        //if we've not processed this URL before
                        var currentURL = aContentLocation.spec;
                        if (!(selectedTab._getadblock_com_blocked_url[currentURL])) {
                            selectedTab._getadblock_com_blocked_url[currentURL] = true;
                            BC.blockCounts.recordOneAdBlocked(tabId);
                        }
                    }
                    var canPurge = (elType & (MY.ElementTypes.image | MY.ElementTypes.subdocument | MY.ElementTypes.object));
                    if (blocked && (canPurge > 0)) {

                        // frameUrl is used by the recipient to determine whether they're the frame who should
                        // receive this or not.  Because the #anchor of a page can change without navigating
                        // the frame, ignore the anchor when matching.
                        var frameUrl = aRequestOrigin.spec.replace(/#.*$/, "");
                        var data = {
                            command: "purge-elements",
                            frameUrl: frameUrl,
                            tabId: tabId,
                            url: aContentLocation.spec,
                            elType: elType
                        };
                        port.chrome.extension.sendRequest(data);
                    }
                }
            } else {
                functions.logging.log("content window null / not found");
                return Ci.nsIContentPolicy.ACCEPT;
            }
        } else if (aContext instanceof nsIDOMWindow) {
            return Ci.nsIContentPolicy.ACCEPT;
        }
        return (blocked ? Ci.nsIContentPolicy.REJECT_REQUEST : Ci.nsIContentPolicy.ACCEPT );
    },


    shouldProcess: function (contentType, contentLocation, requestOrigin, node, mimeTypeGuess, extra) {
        return Ci.nsIContentPolicy.ACCEPT;
    }
});

if (typeof com.getadblock.destroy === "undefined")
    com.getadblock.destroy = {};
com.getadblock.destroy = function () {

    let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
    catMan.deleteCategoryEntry(com.getadblock.xpcom_categories, com.getadblock.contractID, false);

    var unregisterRunnable = {
        run: function () {
            xpcom.unregister(com.getadblock.factory);
        }
    };
    Services.tm.currentThread.dispatch(unregisterRunnable, Ci.nsIEventTarget.DISPATCH_NORMAL);

};
unload.when(com.getadblock.destroy);

if (typeof com.getadblock.factory === "undefined")
    com.getadblock.factory = {};
com.getadblock.factory = xpcom.Factory({
    contract: com.getadblock.contractID,
    Component: com.getadblock.policy,
    register: false,
    unregister: false,
});

xpcom.register(com.getadblock.factory);

if (typeof com.getadblock.contentPolicy === "undefined")
    com.getadblock.contentPolicy = {};
com.getadblock.contentPolicy = Cc[com.getadblock.contractID].createInstance(Ci.nsIContentPolicy);

let catMan = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
catMan.deleteCategoryEntry(com.getadblock.xpcom_categories, com.getadblock.contractID, false);
catMan.addCategoryEntry(com.getadblock.xpcom_categories, com.getadblock.contractID, com.getadblock.contractID, false, true);

// Returns true if anything in whitelist matches the_domain.
//   url: the url of the page
//   type: one out of ElementTypes, default ElementTypes.document,
//         to check what the page is whitelisted for: hiding rules or everything
var page_is_whitelisted = function (url, type) {
    if (!url) {
        return true;
    }
    url = url.replace(/\#.*$/, ''); // Remove anchors
    if (!type)
        type = MY.ElementTypes.document;
    var whitelist = _myFilters.blocking.whitelist;
    return whitelist.matches(url, type, functions.parseUri(url).hostname, false);
};
exports.page_is_whitelisted = page_is_whitelisted;