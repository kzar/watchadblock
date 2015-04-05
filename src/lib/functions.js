"use strict";

// Enabled in background.js if the user wants
var logging = function (enabled) {
    var _enabled = enabled;
    return {
        log: function () {
            if (_enabled) {
                const {components} = require("chrome");
                const { console } = components.utils.import("resource://gre/modules/devtools/Console.jsm", {});
                console.log.apply(console, arguments);
            }
        },
        setLogging: function (enabled) {
            _enabled = enabled;
        }
    }
};
exports.logging = new logging(false); // disabled by default


var translate = function (messageID, args) {
    var port = require("port");
    return port.chrome.i18n.getMessage(messageID, args);
};
exports.translate = translate;

// Determine what language the user's browser is set to use
var determineUserLanguage = function () {
    if (typeof navigator !== 'undefined') {
        if ((typeof navigator.language !== 'undefined') &&
            navigator.language)
            return navigator.language.match(/^[a-z]+/i)[0];
        else
            return null;
    } else {
        var prefs = require("sdk/preferences/service");
        var name = "general.useragent.locale";
        if ((typeof prefs !== 'undefined') &&
            prefs.has(name)) {
            return prefs.get(name).match(/^[a-z]+/i)[0];
        } else {
            return null;
        }
    }
};
exports.determineUserLanguage = determineUserLanguage;

// Parse a URL. Based upon http://blog.stevenlevithan.com/archives/parseuri
// parseUri 1.2.2, (c) Steven Levithan <stevenlevithan.com>, MIT License
// Inputs: url: the URL you want to parse
// Outputs: object containing all parts of |url| as attributes
var parseUri = function (url) {
    var matches = /^(([^:]+(?::|$))(?:(?:\w+:)?\/\/)?(?:[^:@\/]*(?::[^:@\/]*)?@)?(([^:\/?#]*)(?::(\d*))?))((?:[^?#\/]*\/)*[^?#]*)(\?[^#]*)?(\#.*)?/.exec(url);
    // The key values are identical to the JS location object values for that key
    var keys = ["href", "origin", "protocol", "host", "hostname", "port",
        "pathname", "search", "hash"];
    var uri = {};
    for (var i = 0; (matches && i < keys.length); i++)
        uri[keys[i]] = matches[i] || "";
    return uri;
};
exports.parseUri = parseUri;
// Parses the search part of a URL into an key: value object.
// e.g., ?hello=world&ext=adblock would become {hello:"world", ext:"adblock"}
// Inputs: search: the search query of a URL. Must have &-separated values.
parseUri.parseSearch = function (search) {
    // Fails if a key exists twice (e.g., ?a=foo&a=bar would return {a:"bar"}
    search = search.substring(search.indexOf("?") + 1).split("&");
    var params = {}, pair;
    for (var i = 0; i < search.length; i++) {
        pair = search[i].split("=");
        if (pair[0] && !pair[1])
            pair[1] = "";
        if (!params[decodeURIComponent(pair[0])] && decodeURIComponent(pair[1]) === "undefined") {
            continue;
        } else {
            params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
        }
    }
    return params;
};

// Strip third+ level domain names from the domain and return the result.
// Inputs: domain: the domain that should be parsed
//         keepDot: true if trailing dots should be preserved in the domain
// Returns: the parsed domain
parseUri.secondLevelDomainOnly = function (domain, keepDot) {
    var match = domain.match(/([^\.]+\.(?:co\.)?[^\.]+)\.?$/) || [domain, domain];
    return match[keepDot ? 0 : 1].toLowerCase();
};

// Inputs: key:string.
// Returns value if key exists, else undefined.
var storage_get = function (key) {
    var json = require("sdk/simple-storage").storage[key];
    if (json == null)
        return undefined;
    try {
        return JSON.parse(json);
    } catch (e) {
        log("Couldn't parse json for " + key);
        return undefined;
    }
};
exports.storage_get = storage_get;

// Inputs: key:string, value:object.
// If value === undefined, removes key from storage.
// Returns undefined.
var storage_set = function (key, value) {
    if (value === undefined) {
        delete require("sdk/simple-storage").storage[key];
        return;
    } else {
        try {
            require("sdk/simple-storage").storage[key] = JSON.stringify(value);
        } catch (ex) {
            // Firefox throws this error for all writes in Private Browsing mode.
            dump(ex);
        }
    }
};
exports.storage_set = storage_set;

// Return obj[value], first setting it to |defaultValue| if it is undefined.
var setDefault = function (obj, value, defaultValue) {
    if (obj[value] === undefined)
        obj[value] = defaultValue;
    return obj[value];
};
exports.setDefault = setDefault;

var extend = function () {
    var src, copyIsArray, copy, name, options, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

    // Handle a deep copy situation
    if (typeof target === "boolean") {
        deep = target;

        // skip the boolean and the target
        target = arguments[i] || {};
        i++;
    }

    // Handle case when target is a string or something (possible in deep copy)
    if (typeof target !== "object" && typeof target !== "function") {
        target = {};
    }

    // extend jQuery itself if only one argument is passed
    if (i === length) {
        target = this;
        i--;
    }

    for (; i < length; i++) {
        // Only deal with non-null/undefined values
        if ((options = arguments[i]) != null) {
            // Extend the base object
            for (name in options) {
                src = target[name];
                copy = options[name];

                // Prevent never-ending loop
                if (target === copy) {
                    continue;
                }

                // Recurse if we're merging plain objects or arrays
                if (deep && copy && ( isPlainObject(copy) || (copyIsArray = isArray(copy)) )) {
                    if (copyIsArray) {
                        copyIsArray = false;
                        clone = src && isArray(src) ? src : [];

                    } else {
                        clone = src && isPlainObject(src) ? src : {};
                    }

                    // Never move original objects, clone them
                    target[name] = extend(deep, clone, copy);

                    // Don't bring in undefined values
                } else if (copy !== undefined) {
                    target[name] = copy;
                }
            }
        }
    }

    // Return the modified object
    return target;
};
exports.extend = extend;

var isPlainObject = function (obj) {
    var key;

    // Must be an Object.
    // Because of IE, we also have to check the presence of the constructor property.
    // Make sure that DOM nodes and window objects don't pass through, as well
    if (!obj || typeof obj !== "object" || obj.nodeType || obj == obj.window) {
        return false;
    }

    try {
        // Not own constructor property must be Object
        if (obj.constructor && !hasOwn.call(obj, "constructor") && !hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
            return false;
        }
    } catch (e) {
        // IE8,9 Will throw exceptions on certain host objects #9897
        return false;
    }

    // Support: IE<9
    // Handle iteration over inherited properties before own properties.
    if (support.ownLast) {
        for (key in obj) {
            return hasOwn.call(obj, key);
        }
    }

    // Own properties are enumerated firstly, so to speed up,
    // if last one is own, then all properties are own.
    for (key in obj) {
    }

    return key === undefined || hasOwn.call(obj, key);
};
exports.isPlainObject = isPlainObject;

var isArray = function (obj) {
    return typeof obj === "array";
};
exports.isArray = isArray;

var getParentWindow = function (wdow) {
    while (wdow && wdow != wdow.parent) {
        wdow = wdow.parent;
    }
    return wdow;
};
exports.getParentWindow = getParentWindow;

var getWindow = function (node) {
    if ("ownerDocument" in node && node.ownerDocument)
        node = node.ownerDocument;

    if ("defaultView" in node)
        return node.defaultView;

    return null;
};
exports.getWindow = getWindow;


var isHttpUri = function (uri) {
    if (!uri || !uri.scheme) return false;
    return (uri.scheme === 'http' || uri.scheme === 'https');
};
exports.isHttpUri = isHttpUri;

// If url is relative, convert to absolute.
var relativeToAbsoluteUrl = function (url) {
    // Author: Tom Joseph of AdThwart

    if (!url)
        return url;

    // If URL is already absolute, don't mess with it
    if (/^[a-zA-Z\-]+\:/.test(url))
        return url;

    if (url[0] == '/') {
        // Leading // means only the protocol is missing
        if (url[1] && url[1] == "/")
            return document.location.protocol + url;

        // Leading / means absolute path
        return document.location.protocol + "//" + document.location.host + url;
    }

    // Remove filename and add relative URL to it
    var base = document.baseURI.match(/.+\//);
    if (!base)
        return document.baseURI + "/" + url;
    return base[0] + url;
};
exports.relativeToAbsoluteUrl = relativeToAbsoluteUrl;

var isFennec = function () {
    var system = require("sdk/system");
    return system.name === "Fennec";
};
exports.isFennec = isFennec;
