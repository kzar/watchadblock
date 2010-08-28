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

try {
  chrome.extension.getURL; // verify 'extension' property exists
  SAFARI = false;
}
catch (e) {
  SAFARI = true;
}

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
      var _messages = undefined;

      // getMessage() calls this to load messages from disk if they aren't
      // already there.  Note that it can only access the disk if it isn't
      // being called from code injected onto a page; to work correctly when
      // injected onto a page, first call
      // chrome.i18n._setMessagesFileText(data).
      function _loadMessages() {
        var xhr = new XMLHttpRequest();
        var file = chrome.extension.getURL(chrome.i18n._messagesFile);
        xhr.open("GET", file, false);
        xhr.onreadystatechange = function() {
          if(this.readyState == 4) {
            chrome.i18n._setMessagesFileText(this.responseText);
          }
        };
        xhr.send();
      }

      var theI18nObject = {
        // Manually set the messages object for localization.  You only need
        // to call this if using chrome.i18n.getMessage() from a content 
        // script.
        _setMessagesFileText: function(text) {
          // remove comments, which break JSON parsing
          text = text.replace(/\/\/[^\n]+/g, '');
          _messages = JSON.parse(text);
        },

        // Return the extension resource file containing messages localalized
        // to the current locale, e.g. "_locales/de/messages.json".
        get _messagesFile() {
          var locale = "nl"; // TODO
          var filename = '_locales/' + locale + '/messages.json';
          return filename;
        },

        getMessage: function(messageID, args) {
          if (_messages == undefined)
            _loadMessages();
          // TODO: handle args list.
          return _messages[messageID].message;
        }
      };

      return theI18nObject;
    })()
  };
}
