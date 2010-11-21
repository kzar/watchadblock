// Chrome to Safari port
// Author: Michael Gundlach (gundlach@gmail.com)
// License: GPLv3 as part of adblockforchrome.googlecode.com
//          or MIT if GPLv3 conflicts with your code's license.
//
// Porting library to make Chrome extensions work in Safari.
// To use: Add as the first script loaded in your Options page,
// your background page, your Chrome manifest.json, and your
// Safari Info.plist (created by the Extensions Builder).
//
// Then you can use chrome.* APIs as usual, and check the SAFARI
// global boolean variable to see if you're in Safari or Chrome
// for doing browser-specific stuff.  The safari.* APIs will 
// still be available in Safari, and the chrome.* APIs will be
// unchanged in Chrome.

if (typeof SAFARI == "undefined") {

// True in Safari, false in Chrome.
SAFARI = (typeof safari !== "undefined");

if (SAFARI) {
  // Replace the 'chrome' object with a Safari adapter.
  chrome = {
    // Track tabs that make requests to the global page, assigning them
    // IDs so we can recognize them later.
    __getTabId: (function() {
      // Tab objects are destroyed when no one has a reference to them,
      // so we keep a list of them, lest our IDs get lost.
      var tabs = [];
      var lastAssignedTabId = 0;
      var theFunction = function(tab) {
        // Clean up closed tabs, to avoid memory bloat.
        tabs = tabs.filter(function(t) { return t.browserWindow != null; });

        if (tab.id == undefined) {
          // New tab
          tab.id = lastAssignedTabId + 1;
          lastAssignedTabId = tab.id;
          tabs.push(tab); // save so it isn't garbage collected, losing our ID.
        }
        return tab.id;
      };
      return theFunction;
    })(),

    extension: {
      getURL: function(path) { 
        return safari.extension.baseURI + path;
      },

      sendRequest: (function() {
        // The function we'll return at the end of all this
        function theFunction(data, callback) {
          var callbackToken = "callback" + Math.random();

          // Listen for a response for our specific request token.
          addOneTimeResponseListener(callbackToken, callback);

          safari.self.tab.dispatchMessage("request", {
            data: data,
            callbackToken: callbackToken
          });
        }

        // Make a listener that, when it hears sendResponse for the given 
        // callbackToken, calls callback(resultData) and deregisters the 
        // listener.
        function addOneTimeResponseListener(callbackToken, callback) {

          var responseHandler = function(messageEvent) {
            if (messageEvent.name != "response")
              return;
            if (messageEvent.message.callbackToken != callbackToken)
              return;

            callback(messageEvent.message.data);
            // Change to calling in 0-ms setTimeout, as Safari team thinks
            // this will work around their crashing until they can release
            // a fix.
            // safari.self.removeEventListener("message", responseHandler, false);
            window.setTimeout(function() {
              safari.self.removeEventListener("message", responseHandler, false);
            }, 0);
          };

          safari.self.addEventListener("message", responseHandler, false);
        }

        return theFunction;
      })(),

      onRequest: {
        addListener: function(handler) {
          safari.application.addEventListener("message", function(messageEvent) {
            // Only listen for "sendRequest" messages
            if (messageEvent.name != "request")
              return;

            var request = messageEvent.message.data;
            var id = chrome.__getTabId(messageEvent.target);

            var sender = { tab: { id: id } };
            var sendResponse = function(dataToSend) {
              var responseMessage = { callbackToken: messageEvent.message.callbackToken, data: dataToSend };
              messageEvent.target.page.dispatchMessage("response", responseMessage);
            }
            handler(request, sender, sendResponse);
          }, false);
        },
      },

      connect: function(port_data) {
        var portUuid = "portUuid" + Math.random();
        safari.self.tab.dispatchMessage("port-create", {name: port_data.name, uuid: portUuid});

        var newPort = {
          name: port_data.name,
          onMessage: { 
            addListener: function(listener) {
              safari.self.addEventListener("message", function(messageEvent) {
                // If the message was a port.postMessage to our port, notify our listener.
                if (messageEvent.name != "port-postMessage") 
                  return;
                if (messageEvent.message.portUuid != portUuid)
                  return;
                listener(messageEvent.message.data);
              });
            } 
          }
        };
        return newPort;
      },

      onConnect: {
        addListener: function(handler) {
          // Listen for port creations
          safari.application.addEventListener("message", function(messageEvent) {
            if (messageEvent.name != "port-create")
              return;

            var portName = messageEvent.message.name;
            var portUuid = messageEvent.message.uuid;

            var id = chrome.__getTabId(messageEvent.target);

            var newPort = {
              name: portName,
              sender: { tab: { id: id } },
              onDisconnect: { 
                addListener: function() { 
                  console.log("CHROME PORT LIBRARY: chrome.extension.onConnect.addListener: port.onDisconnect is not implemented, so I'm doing nothing.");
                }
              },
              postMessage: function(data) {
                if (! messageEvent.target.page) {
                  console.log("Oops, this port has already disappeared -- cancelling.");
                  return;
                }
                messageEvent.target.page.dispatchMessage("port-postMessage", { portUuid: portUuid, data: data });
              }
            };

            // Inform the onNewPort caller about the new port
            handler(newPort);
          });
        }
      },

      onRequestExternal: {
        addListener: function() {
          console.log("CHROME PORT LIBRARY: onRequestExternal not supported.");
        }
      }
    },

    i18n: (function() {

      function syncFetch(file, fn) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.extension.getURL(file), false);
        xhr.onreadystatechange = function() {
          if(this.readyState == 4 && this.responseText != "") {
            fn(this.responseText);
          }
        };
        try {
          xhr.send();
        }
        catch (e) {
          // File not found, perhaps
        }
      }

      // Parse JSON even if it contains comments.
      function safe_JSON_parse(text) {
        // Match any char but a colon, then //, then the rest of the line
        // Replace it with the matched char.
        // This is to avoid matching the // in "http://foo.com"
        text = text.replace(/([^:])\/\/[^\n]+/g, '$1');
        // And match // at the start of the line, since the above forces it
        // to have a leading character.
        text = text.replace(/^\/\/[^\n]+/g, '');
        return JSON.parse(text);
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
        var $n_subber = function(_, num) { return args[num - 1]; };

        var placeholders = {};
        // Fill in $N in placeholders
        for (var name in msgData.placeholders) {
          var content = msgData.placeholders[name].content;
          placeholders[name.toLowerCase()] = safesub(content, $n_re, $n_subber);
        }
        // Fill in $N in message
        var message = safesub(msgData.message, $n_re, $n_subber);
        // Fill in $Place_Holder1$ in message
        message = safesub(message, /\$([a-zA-Z0-9_]+?)\$/g, function(full, name) {
          var lowered = name.toLowerCase();
          if (lowered in placeholders)
            return placeholders[lowered];
          return full; // e.g. '$FoO$' instead of 'foo'
        });
        // Replace $$ with $
        message = message.replace(/\$\$/g, '$');

        return message;
      }

      var l10nData = undefined;

      var theI18nObject = {
        // chrome.i18n.getMessage() may be used in any extension resource page
        // without any preparation.  But if you want to use it from a content
        // script in Safari, the content script must first run code like this:
        //
        //   get_localization_data_from_global_page_async(function(data) {
        //     chrome.i18n._setL10nData(data);
        //     // now I can call chrome.i18n.getMessage()
        //   });
        //   // I cannot call getMessage() here because the above call
        //   // is asynchronous.
        //
        // The global page will need to receive your request message, call
        // chrome.i18n._getL10nData(), and return its result.
        //
        // We can't avoid this, because the content script can't load
        // l10n data for itself, because it's not allowed to make the xhr
        // call to load the message files from disk.  Sorry :(
        _getL10nData: function() {
          var result = { locales: [] };

          // == Find all locales we might need to pull messages from, in order
          // 1: The user's current locale, converted to match the format of
          //    the _locales directories (e.g. "en-US" becomes "en_US"
          result.locales.push(navigator.language.replace('-', '_'));
          // 2: Perhaps a region-agnostic version of the current locale
          if (navigator.language.length > 2)
            result.locales.push(navigator.language.substring(0, 2));
          // 3: Default locale
          syncFetch("manifest.json", function(manifestText) {
            var defaultLocale = safe_JSON_parse(manifestText).default_locale;
            if (result.locales.indexOf(defaultLocale) == -1)
              result.locales.push(defaultLocale);
          });

          // Load all locale files that exist in that list
          result.messages = {};
          for (var i = 0; i < result.locales.length; i++) {
            locale = result.locales[i];
            var file = "_locales/" + locale + "/messages.json";
            // Doesn't call the callback if file doesn't exist
            syncFetch(file, function(text) {
              result.messages[locale] = safe_JSON_parse(text);
            });
          }

          return result;
        },

        // Manually set the localization data.  You only need to call this
        // if using chrome.i18n.getMessage() from a content script, before
        // the first call.  You must pass the value of _getL10nData(),
        // which can only be called by the global page.
        _setL10nData: function(data) {
          l10nData = data;
        },

        getMessage: function(messageID, args) {
          if (l10nData == undefined) {
            // Assume that we're not in a content script, because content 
            // scripts are supposed to have set l10nData already
            chrome.i18n._setL10nData(chrome.i18n._getL10nData());
          }
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

} // end if (typeof SAFARI == "undefined")
