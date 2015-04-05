//inject from main.js as a content script
//when the user has enabled the whitelist youtube feature, and the URL is youtube.com

"use strict";

// Store actual URL
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

// Get id of the channel
function getChannelId(url) {
    return parseUri(url).pathname.split("/")[2];
}

// Get id of the video
function getVideoId(url) {
    return parseUri.parseSearch(parseUri(url).search).v;
}

// Function which: - adds name of the channel on the end of the URL, e.g. &channel=nameofthechannel
//                 - reload the page, so AdBlock can properly whitelist the page (just if channel is whitelisted by user)
function updateURL(url, channelName, isChannel) {
    if (isChannel) {
        var updatedUrl = url + "?&ab_channel=" + channelName.replace(/\s/g, "");
    } else {
        var updatedUrl = url + "&ab_channel=" + channelName.replace(/\s/g, "");
    }
    // Add the name of the channel to the end of URL
    window.history.replaceState(null, null, updatedUrl);
    // Reload page from cache
    document.location.reload(false);
}

function processYouTubeDOM() {
    var url = document.location.href;
    if (!/ab_channel/.test(url)) {
        // Get name of the channel by using YouTube Data v3 API
        if (/channel/.test(url)) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET",
                "https://www.googleapis.com/youtube/v3/channels?part=snippet&id=" + getChannelId(url) +
                "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz"), true);
            xhr.onload = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    var json = JSON.parse(xhr.response);
                    // Got name of the channel
                    if (json.items[0]) {
                        updateURL(url, json.items[0].snippet.title, true);
                    }
                }
            };
            xhr.send();
        } else if (/watch/.test(url)) {
            var xhr = new XMLHttpRequest();
            var requestURL = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=" + getVideoId(url) +
                "&key=" + atob("QUl6YVN5QzJKMG5lbkhJZ083amZaUUYwaVdaN3BKd3dsMFczdUlz");
            xhr.open("GET", requestURL, true);
            xhr.onload = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    var json = JSON.parse(xhr.response);
                    // Got name of the channel
                    if (json.items[0]) {
                        updateURL(url, json.items[0].snippet.channelTitle, false);
                    }
                }
            };
            xhr.send();
        } else {
            if (/user/.test(url)) {
                var channelName = document.querySelector("span .qualified-channel-title-text > a");
                if (channelName &&
                    channelName.textContent) {
                    updateURL(url, channelName.textContent, true);
                }
            }
        }
    }
}//end of processYouTubeDOM
processYouTubeDOM();
document.addEventListener("spfdone", function (e) {
    processYouTubeDOM();
});
