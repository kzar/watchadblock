// Set to true to get noisier console.log statements
VERBOSE_DEBUG = false;

// Run a function on the background page.
// Inputs (positional):
//   first, a string - the name of the function to call
//   then, any arguments to pass to the function (optional)
//   then, a callback:function(return_value:any) (optional)
BGcall = function() {
  var args = [];
  for (var i=0; i < arguments.length; i++)
    args.push(arguments[i]);
  var fn = args.shift();
  var has_callback = (typeof args[args.length - 1] == "function");
  var callback = (has_callback ? args.pop() : function() {});
  chrome.extension.sendRequest({command: "call", fn:fn, args:args}, callback);
}

// These are replaced with console.log in adblock_start.js and background.html
// if the user chooses.
log = function() { };

// Behaves very similarly to $.ready() but does not require jQuery.
function onReady(callback) {
  if (document.readyState === "complete")
    window.setTimeout(callback, 0);
  else
    window.addEventListener("load", callback, false);
}

function translate(messageID, args) {
  return chrome.i18n.getMessage(messageID, args);
}

function localizePage() {
  //translate a page into the users language
  $("[i18n]:not(.i18n-replaced)").each(function() {
    $(this).html(translate($(this).attr("i18n")));
  });
  $("[i18n_value]:not(.i18n-replaced)").each(function() {
    $(this).val(translate($(this).attr("i18n_value")));
  });
  $("[i18n_title]:not(.i18n-replaced)").each(function() {
    $(this).attr("title", translate($(this).attr("i18n_title")));
  });
  $("[i18n_replacement_el]:not(.i18n-replaced)").each(function() {
    // Replace a dummy <a/> inside of localized text with a real element.
    // Give the real element the same text as the dummy link.
    var dummy_link = $("a", this);
    var text = dummy_link.text();
    var real_el = $("#" + $(this).attr("i18n_replacement_el"));
    real_el.text(text).val(text).replaceAll(dummy_link);
    // If localizePage is run again, don't let the [i18n] code above
    // clobber our work
    $(this).addClass("i18n-replaced");
  });
}

// Parse a URL. Based upon http://blog.stevenlevithan.com/archives/parseuri
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
// Inputs: url: the URL you want to parse
// Outputs: object containing all parts of |url| as attributes
parseUri = function(url) {
  var matches = /^(([^:]+(?::|$))(?:(?:[^:]+:)?\/\/)?(?:[^:@]*(?::[^:@]*)?@)?(([^:\/?#]*)(?::(\d*))?))((?:[^?#\/]*\/)*[^?#]*)(\?[^#]*)?(\#.*)?/.exec(url);
  // The key values are identical to the JS location object values for that key
  var keys = ["href", "origin", "protocol", "host", "hostname", "port",
              "pathname", "search", "hash"];
  var uri = {};
  for (var i=0; i<keys.length; i++)
    uri[keys[i]] = matches[i] || "";
  return uri;
};
// Parses the search part of a URL into an key: value object.
// e.g., ?hello=world&ext=adblock would become {hello:"world", ext:"adblock"}
// Inputs: search: the search query of a URL. Must have &-separated values.
parseUri.parseSearch = function(search) {
  // Fails if a key exists twice (e.g., ?a=foo&a=bar would return {a:"bar"}
  var queryKeys = {};
  search.replace(/(?:^\?|&)([^&=]*)=?([^&]*)/g, function () {
    if (arguments[1]) queryKeys[arguments[1]] = unescape(arguments[2]);
  });
  return queryKeys;
}

// TODO: move back into background.html since Safari can't use this
// anywhere but in the background.  Do it after merging 6101 and 6238
// and 5912 to avoid merge conflicts.
// Inputs: key:string.
// Returns value if key exists, else undefined.
storage_get = function(key) {
  var store = (window.SAFARI ? safari.extension.settings : localStorage);
  var json = store.getItem(key);
  if (json == null)
    return undefined;
  try {
    return JSON.parse(json);
  } catch (e) {
    log("Couldn't parse json for " + key);
    return undefined;
  }
}

// Inputs: key:string, value:object.
// Returns undefined.
storage_set = function(key, value) {
  var store = (window.SAFARI ? safari.extension.settings : localStorage);
  try {
    store.setItem(key, JSON.stringify(value));
  } catch (ex) {
    // Safari throws this error for all writes in Private Browsing mode.
    // TODO: deal with the Safari case more gracefully.
    if (ex.name == "QUOTA_EXCEEDED_ERR" && !SAFARI) {
      alert(translate("storage_quota_exceeded"));
      openTab("options/index.html#ui-tabs-2");
    }
  }
}

// Parses Safari property list documents
// Inputs: document:Document
// Returns plist contents as a javascript value or null on errors
// See: http://developer.apple.com/documentation/Darwin/Reference/ManPages/man5/plist.5.html
parsePlist = function(document) {
  var root = document.documentElement;

  function parseElement(elem) {
    if (elem.tagName === 'true') {
      return true;
    } else if (elem.tagName === 'false') {
      return false;
    } else if (elem.tagName === 'string' || elem.tagName === 'data') {
      return elem.textContent;
    } else if (elem.tagName === 'real') {
      return parseFloat(elem.textContent);
    } else if (elem.tagName === 'integer') {
      return parseInt(elem.textContent, 10);
    } else if (elem.tagName === 'date') {
      return new Date(Date.parse(elem.textContent));
    } else if (elem.tagName === 'array') {
      var result = [];
      for (var i = 0; i < elem.childNodes.length; i++) {
        var child = elem.childNodes.item(i);
        if (child.nodeType === Node.ELEMENT_NODE) {
          result.push(parseElement(child));
        }
      }
      return result;
    } else if (elem.tagName === 'dict') {
      var result = {};
      var key = null;
      for (var i = 0; i < elem.childNodes.length; i++) {
        var child = elem.childNodes.item(i);
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (key) {
            result[key] = parseElement(child);
            key = null;
          } else if (child.tagName === 'key') {
            key = child.textContent;
          }
        }
      }
      return result;
    }
  }

  if (root && root.tagName === 'plist') {
    for (var i = 0; i < root.childNodes.length; i++) {
      var child = root.childNodes.item(i);
      if (child.nodeType === Node.ELEMENT_NODE) {
        return parseElement(child);
      }
    }
    return parseElement(root.firstChild);
  } else {
    return null;
  }
}

// Checks if the extension is up-to-date
// Inputs:
//   checkReason:string - update check reason appended to safari plist url, ignored on chrome
//   callback:function(uptodate, updateURL) - called when update finishes
performUpdateCheck = (function() {
  function fetchResource(url, callback) {
      var req = new XMLHttpRequest();
      req.open("GET", url, true);
      req.onreadystatechange = function() {
        if (req.readyState === 4 && req.responseText) {
          callback(req.responseText);
        }
      };
      req.send();
  }

  var fetchLocalManifest;
  if (SAFARI) {
    fetchLocalManifest = function(callback) {
      fetchResource(safari.extension.baseURI + "Info.plist",
                    function(response) {
                      callback(parsePlist(new DOMParser().parseFromString(response, "application/xml")));
                    });
    }
  } else {
    fetchLocalManifest = function(callback) {
      fetchResource(chrome.extension.getURL('manifest.json'),
                    function(response) {
                      callback(JSON.parse(response));
                    });
    }
  }

  function compareVersions(versionA, versionB) {
    var versionRegex = /^(\d+)\.(\d+)\.(\d+)$/;
    var matchA = versionA.match(versionRegex);
    var matchB = versionB.match(versionRegex);
    if (!matchA || !matchB) {
      throw "Invalid version string";
    }

    for (var i = 1; i < matchA.length; i++) {
      var a = parseInt(matchA[i], 10);
      var b = parseInt(matchB[i], 10);
      if (a < b) {
        return -1;
      } else if (a > b) {
        return 1;
      }
    }
    return 0;
  }

  if (SAFARI) {
    return function(checkReason, callback) {
      fetchLocalManifest(function(manifest) {
        var updateURL = manifest["Update Manifest URL"];
        var currentVersion = manifest["CFBundleVersion"];
        var bundleIdentifier = manifest["CFBundleIdentifier"];

        fetchResource(
          updateURL + "?" + checkReason,
          function(response) {
            var updateManifest = parsePlist(new DOMParser().parseFromString(response, "application/xml"));
            var updates = updateManifest["Extension Updates"];
            for (var i = 0; i < updates.length; i++) {
              var update = updates[i];
              if (update["CFBundleIdentifier"] === bundleIdentifier) {
                var latestVersion = update["CFBundleVersion"];
                var extURL = update["URL"];
                var uptodate = (compareVersions(currentVersion, latestVersion) >= 0);
                callback(uptodate, extURL);
              }
            }
          });
      });
    }
  } else {
    return function(checkReason, callback) {
      fetchLocalManifest(function(manifest) {
        var currentVersion = manifest["version"];
        var checkURL = "http://clients2.google.com/service/update2/crx?" +
                       "x=id%3Dgighmmpiobklfepjocnamgkkbiglidom%26v%3D" +
                       currentVersion + "%26uc";
        fetchResource(
          checkURL,
          function(response) {
            // It looks like WebKit engines have problems with namespace resolutions,
            // so we'll have to hunt for nodes using name() in the XPath.
            var responseXML = new DOMParser().parseFromString(response, "application/xml");
            var updateURL = responseXML.evaluate("//*[name() = 'updatecheck' and @status = 'ok']/@codebase",
                                                 responseXML, null, XPathResult.STRING_TYPE, null).stringValue;
            if (updateURL) {
              callback(false, updateURL);
            } else if (responseXML.evaluate("//*[name() = 'updatecheck' and @status = 'noupdate']",
                                            responseXML, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue) {
              callback(true);
            }
          });
      });
    }
  }
})();
