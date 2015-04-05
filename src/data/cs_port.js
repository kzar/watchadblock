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

"use strict";

if (typeof CHROME === "undefined") {
    (function (globals) {

        // True in Safari, false in Chrome.
        globals.CHROME = (function () {
            return (typeof safari === "undefined" &&
            typeof chrome !== "undefined" &&
            typeof require === 'undefined' &&
            typeof self === 'undefined');
        })();

    })(this);
} // end if (typeof CHROME == "undefined")


if (typeof FIREFOX === "undefined") {

    (function (globals) {
        // True in FireFox, false in Chrome & Safari
        globals.FIREFOX = (function () {
            return (typeof safari === "undefined" &&
            typeof chrome === "undefined" &&
            (typeof require !== 'undefined' ||
            typeof self !== 'undefined'));
        })(this);


        if (globals.FIREFOX) {
            //an array of functions that want to be called when messages are emit, such as 'filters_updated' and 'call'
            //typically the listener is a content script.
            var contentScriptListeners = [];

            var myPort = ((typeof self !== 'undefined') && self.port) || ((typeof addon !== 'undefined') && addon.port);
            if (typeof myPort !== 'undefined' && myPort) {
                myPort.on("filters_updated", function (request) {
                    for (var inx = 0; inx < contentScriptListeners.length; inx++) {
                        contentScriptListeners[inx](request);
                    }
                });
                myPort.on("malware_domains", function (request) {
                    for (var inx = 0; inx < contentScriptListeners.length; inx++) {
                        contentScriptListeners[inx](request);
                    }
                });
                myPort.on("filter_syntax_url", function (request) {
                    for (var inx = 0; inx < contentScriptListeners.length; inx++) {
                        contentScriptListeners[inx](request);
                    }
                });
                myPort.on("reloadcomplete", function (request) {
                    for (var inx = 0; inx < contentScriptListeners.length; inx++) {
                        contentScriptListeners[inx](request);
                    }
                });
                myPort.on("amo_info", function(request) {
                    for (var inx = 0; inx < contentScriptListeners.length ; inx++) {
                        contentScriptListeners[inx](request);
                    }
                });                
            }

            // Replace the 'chrome' object with a FireFox adapter.
            globals.chrome = {
                extension: {

                    getBackgroundPage: function () {
                        return null;
                    },

                    getURL: function (path, fn) {
                        return null;
                    },

                    sendRequest: function (args, callback) {
                        var myPort = self.port || addon.port;
                        if (typeof myPort === 'undefined') {
                            functions.logging.log("no port found for call", JSON.stringify(args));
                            return;
                        }

                        //register the 'listener' for a callback, if there is one.
                        if (typeof callback !== "undefined" && callback) {

                            //generate a unique ID it to avoid collisions
                            //from sequential calls to the background from the options pages.
                            var uniqueID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                                return v.toString(16);
                            });
                            args.uniqueID = uniqueID;
                            var callbackHandler = function (callbackArgs) {
                                callback(callbackArgs);
                                myPort.removeListener((args.command + args.uniqueID), callbackHandler);
                            };
                            //Use the Command to 'listen' for the callback
                            myPort.on((args.command + args.uniqueID), callbackHandler);
                        }
                        //now, send the message...
                        myPort.emit(args.command, args);
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
                },
                runtime: {
                    getManifest: function (fn) {
                        var xhr = new XMLHttpRequest();
                        xhr.open("GET", "manifest.json", true);
                        xhr.onload = function () {
                            fn(xhr.responseText);
                        };
                        xhr.send();
                        return null;
                    }
                },
                i18n: (function () {
                    function getFileByLocale(locale, callBackgroundPage, fn) {
                        if (!callBackgroundPage) {
                            var xhr = new XMLHttpRequest();
                            xhr.open("GET", "../_locales/" + locale + "/messages.json", true);
                            xhr.onload = function () {
                                fn({locale: locale, contents: xhr.responseText});
                            };
                            try {
                                xhr.send();
                            } catch (e) {
                                //file not found, send back empty object;
                                fn('{ "locale" : "' + locale + '", "failed":"true" }');
                            }
                        } else {
                            //used by the ui wizards
                            BGcall('getLocaleFile', locale, function (result) {
                                fn({locale: locale, contents: JSON.parse(result)});
                            });
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
                        if ((typeof navigator.language !== 'undefined') &&
                            navigator.language) {
                            // == Find all locales we might need to pull messages from, in order
                            // 1: The user's current locale, converted to match the format of
                            //    the _locales directories (e.g. "en-US" becomes "en_US"
                            l10nData.locales.push(navigator.language.replace('-', '_'));
                            // 2: Perhaps a region-agnostic version of the current locale
                            if (navigator.language.length > 2)
                                l10nData.locales.push(navigator.language.substring(0, 2));
                        }
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
                                if (map && messageID in map)
                                    return parseString(map[messageID], args);

                            }
                            return "";
                        }
                    };
                    return theI18nObject;
                })()
            };
        }
    })(this);
} // end if (typeof FIREFOX == "undefined")

