"use strict";

// Chrome to FireFox port
// License: GPLv3 as part of code.getadblock.com
//          or MIT if GPLv3 conflicts with your code's license.
//
// Porting library to make Chrome extensions work in Firefox.
// To use: Add as a script loaded in main.js and content scripts, etc.
//
// Then you can use chrome.* APIs as usual, and check the FIREFOX
// global boolean variable to see if you're in Firefox, Safari or Chrome
// for doing browser-specific stuff.  The safari.* APIs will
// still be available in Safari, and the chrome.* APIs will be
// unchanged in Chrome.

if (typeof CHROME === "undefined") {
    (function (globals) {
        globals.CHROME = false;
    })(this);
    exports.CHROME = CHROME;
} // end if (typeof CHROME == "undefined")


if (typeof FIREFOX === "undefined") {

    (function (globals) {

        globals.FIREFOX = true;
        exports.FIREFOX = FIREFOX;

        var handleContentScriptError = function (worker, error) {
            var str = "Error: " +
                (error.fileName || "anywhere") +
                ":" + (error.lineNumber || "anywhere");
            var stack = "-" + ((error && error.message) || "") +
                "-" + ((error && error.stack) || "");
            stack = stack.replace(/:/gi, ";").replace(/\n/gi, "");
            //check to see if there's any URL info in the stack trace, if so remove it
            if (stack.indexOf("http") >= 0) {
                stack = "-removed URL-";
            }
            str += stack;
            require("stats").STATS.msg(str);
            require("functions").logging.log(str);
        };
        //remove old workers from the workers array.
        var detachWorker = function (worker) {
            //get the index of the worker were processing in the worker array
            var index = workers.indexOf(worker);
            if (worker !== 'undefined' &&
                worker.tab !== 'undefined' &&
                worker.tab !== null &&
                worker.tab.id !== 'undefined') {
                var tab = require('sdk/tabs/utils').getTabForId(worker.tab.id);
                if (tab) {
                    //zero / nullify out the adblock specific items we store on each tab
                    tab._getadblock_com_blockcount = 0;
                    delete tab._getadblock_com_resources;
                    tab._getadblock_com_isWhitelisted = null;
                }
            }
            const { remove } = require("sdk/util/array");
            remove(workers, worker);
            if (!require("functions").isFennec()) {
                var UI = require("uiwidgets");
                UI.updateButtonUIAndContextMenus();
            }
        };

        //A list of all of the PageWorkers, both from injected content scripts, and UI components,
        //including the options pages, button, etc.
        var workers = [];

        //an array of functions that want to be called when messages are emit, such as 'filters_updated' and 'call'
        //typically the listener is a content script.
        var contentScriptListeners = [];

        // Replace the 'chrome' object with a FireFox adapter.
        globals.chrome = {
            //Listen for calls from injected content scripts, option pages,
            startListening: function (worker) {
                var functions = require("functions");
                const { add } = require("sdk/util/array");
                add(workers, worker);
                worker.on('pageshow', function () {
                    add(workers, this);
                });
                worker.on('pagehide', function () {
                    detachWorker(this);
                });
                worker.on('detach', function () {
                    detachWorker(this);
                });
                worker.port.on("call", function (request) {
                    var background = require("background");
                    var fn = background[request.fn];
                    if (typeof fn === 'undefined') {
                        fn = functions[request.fn];
                    }
                    if (typeof fn === 'undefined') {
                        var firefox_bg = require("firefox_bg");
                        fn = firefox_bg[request.fn];
                    }
                    if (typeof fn === 'undefined') {
                        var CP = require("contentpolicy");
                        fn = CP.MY.FilterNormalizer[request.fn];
                        if (typeof fn === 'undefined') {
                            fn = CP.MY.Filter[request.fn];
                        }
                        if (typeof fn === 'undefined') {
                            fn = CP.MY.PatternFilter[request.fn];
                        }
                        if (typeof fn === 'undefined') {
                            fn = CP.MY.SelectorFilter[request.fn];
                        }
                    }
                    if (typeof fn === 'undefined' && (!functions.isFennec())) {
                        var UI = require("uiwidgets");
                        fn = UI[request.fn];
                    }
                    if (typeof fn === 'undefined') {
                        var helper = require("resourceblockerhelper");
                        fn = helper[request.fn];
                    }
                    if (typeof fn === 'undefined') {
                        fn = exports[request.fn];
                    }
                    if (typeof fn === 'undefined') {
                        functions.logging.log("content script worker called function", request.fn, "but it was not found");
                        return;
                    }
                    var sender = {};
                    sender.tab = worker.tab;
                    request.args.push(sender);
                    var result = fn.apply(null, request.args);
                    if (typeof request.uniqueID === 'undefined') {
                        worker.port.emit('call', result);
                    } else {
                        worker.port.emit(('call' + request.uniqueID), result);
                    }
                });
                worker.on('error', function (error) {
                    handleContentScriptError(this, error);
                });
            },
            extension: {
                destroy: function (reason) {
                    while (workers.length > 0) {
                        workers.pop();
                    }
                    while (contentScriptListeners.length > 0) {
                        contentScriptListeners.pop();
                    }
                },

                getBackgroundPage: function () {
                    return null;
                },

                getURL: function (path, fn) {
                    return require("sdk/self").data.url(path);
                },

                sendRequest: function (args, callback) {
                    //forward message to content scripts
                    for (var inx = 0; inx < workers.length; inx++) {
                        //if the message is for a specific tab, only send the message to it.
                        if (args.tabId &&
                            workers[inx].tab &&
                            workers[inx].tab.id === args.tabId) {
                            workers[inx].port.emit(args.command, args);
                        } else if (!args.tabId) {
                            workers[inx].port.emit(args.command, args);
                        }
                    }
                },

                onRequest: {
                    addListener: function (handler) {
                        contentScriptListeners.push(handler);
                    }
                },

                onRequestExternal: {
                    addListener: function () {
                        return null;
                        //onRequestExternal not supported.
                    }
                }
            },//end of 'extension'
            runtime: {
                getManifest: function (fn) {
                    var data = require("sdk/self").data;
                    var object = JSON.parse(data.load("manifest.json"));
                    return object;
                }
            },//end of 'runtime`
            i18n: (function () {
                function getFileByLocale(locale, callBackgroundPage, fn) {

                    var data = require("sdk/self").data;
                    try {
                        var localeContents = data.load("_locales/" + locale + "/messages.json");
                        fn({locale: locale, contents: localeContents});
                    } catch (ex) {//do nothing - file not found
                        fn('{ "locale" : "' + locale + '", "failed":"true" }');
                    }
                }

                // Insert substitution args into a localized string.
                function parseString(msgData, args) {
                    // If no substitution, just turn $$ into $ and short-circuit.
                    if (msgData.placeholders == undefined && args == undefined)
                        return msgData.message.replace(/\$\$/g, '$');

                    // Substitute a regex while understanding that $$ should be untouched
                    function safesub(txt, re, replacement) {
                        var dollaRegex = /\$\$/g, dollaSub = "~~~I18N~~:";
                        txt = txt.replace(dollaRegex, dollaSub);
                        txt = txt.replace(re, replacement);
                        // Put back in "$$" ("$$$$" somehow escapes down to "$$")
                        var undollaRegex = /~~~I18N~~:/g, undollaSub = "$$$$";
                        txt = txt.replace(undollaRegex, undollaSub);
                        return txt;
                    }

                    var $n_re = /\$([1-9])/g;
                    var $n_subber = function (_, num) {
                        return args[num - 1];
                    };

                    var placeholders = {};
                    // Fill in $N in placeholders
                    for (var name in msgData.placeholders) {
                        var content = msgData.placeholders[name].content;
                        placeholders[name.toLowerCase()] = safesub(content, $n_re, $n_subber);
                    }
                    // Fill in $N in message
                    var message = safesub(msgData.message, $n_re, $n_subber);
                    // Fill in $Place_Holder1$ in message
                    message = safesub(message, /\$(\w+?)\$/g, function (full, name) {
                        var lowered = name.toLowerCase();
                        if (lowered in placeholders)
                            return placeholders[lowered];
                        return full; // e.g. '$FoO$' instead of 'foo'
                    });
                    // Replace $$ with $
                    message = message.replace(/\$\$/g, '$');
                    return message;
                }

                function _initL10nData(callbackFunction, callBackgroundPage) {
                    if (l10nData === undefined) {
                        l10nData = {locales: []};
                        l10nData.messages = {};
                    }
                    // == Find all locales we might need to pull messages from, in order
                    var language = require("functions").determineUserLanguage();
                    if (language && language.length > 2)
                        l10nData.locales.push(language.substring(0, 2));
                    // 3: Set English 'en' as default locale
                    if (l10nData.locales.indexOf("en") == -1)
                        l10nData.locales.push("en");

                    // Load all locale files that exist in that list
                    var numberOfFilesToProcess = l10nData.locales.length;

                    for (var i = 0; i < l10nData.locales.length; i++) {
                        var locale = l10nData.locales[i];
                        // Doesn't call the callback if file doesn't exist
                        getFileByLocale(locale, callBackgroundPage, function (response) {
                            if (response && response.locale && response.contents) {
                                try {
                                    l10nData.messages[response.locale] = JSON.parse(response.contents);
                                } catch (ex) {
                                    l10nData.messages[response.locale] = null;
                                }
                            }
                            numberOfFilesToProcess--;
                            if ((numberOfFilesToProcess === 0) &&
                                callbackFunction &&
                                (typeof callbackFunction === 'function')) {

                                callbackFunction();
                            }
                        });
                    }
                }

                var l10nData = undefined;

                var theI18nObject = {
                    // Manually set the localization data.
                    _setL10nData: function (data) {
                        l10nData = data;
                    },
                    getL10nData: function () {
                        return l10nData;
                    },
                    // Clean up when we're done
                    destroy: function () {
                        while (l10nData && l10nData.locales.length > 0) {
                            l10nData.locales.pop();
                        }
                        l10nData = undefined;
                    },

                    //called from any Widget UI, Options page that requires translation.
                    //
                    //If localizePage() is called, then this needs be invoked first,
                    //and then localizePage() can be safely called in the 'callbackFunction'
                    //this is done becausee the locale files are loaded async.
                    initializeL10nData: function (callbackFunction, callBackgroundPage) {
                        if (l10nData == undefined) {
                            _initL10nData(callbackFunction, callBackgroundPage);
                        } else {
                            callbackFunction();
                        }
                    },

                    getMessage: function (messageID, args) {
                        if (l10nData == undefined) {
                            // Assume that we're not in a content script, because content
                            // scripts are supposed to have initialized theL10D first using
                            // initializeL10nData()
                            _initL10nData();
                        }

                        if (typeof args == "string")
                            args = [args];
                        for (var i = 0; i < l10nData.locales.length; i++) {
                            var map = l10nData.messages[l10nData.locales[i]];
                            // We must have the locale, and the locale must have the message
                            if (map && messageID in map) {
                                return parseString(map[messageID], args);
                            }
                        }
                        return "";
                    }
                };
                return theI18nObject;
            })()
            //end of 'runtime`
        };//end of globals.chrome;
    })(this);
    exports.chrome = chrome;
} // end if (typeof FIREFOX == "undefined")