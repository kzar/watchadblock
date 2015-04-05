"use strict";

exports.getLocalFileURL = function (path) {
    return require("sdk/self").data.url(path);
};

var getLocalFileContents = function (path) {
    try {
        return require("sdk/self").data.load(path);
    } catch (e) {
        //For File Not Founds...return null
        return null;
    }
};
exports.getLocalFileContents = getLocalFileContents;

exports.getLocaleFile = function (request) {
    var response = JSON.stringify(getLocalFileContents("_locales/" + request + "/messages.json"));
    if (!response || response.trim().length === 0) {
        response = "{}";
    }
    return response;
};

exports.getFirefoxManifest = function (fn) {
    var self = require("sdk/self");
    var manifest = {version: self.version, uri: self.uri, id: self.id, name: self.name};
    if (typeof fn === "function")
        fn(manifest);
    return manifest;
};

exports.get_filter_syntax_url = function () {
    //try to get filter syntax page with users language
    //if it fails, default to english (en).
    var syntaxURL = "https://adblockplus.org/" +
        require("functions").determineUserLanguage() +
        "/filters";
    const { XMLHttpRequest } = require("sdk/net/xhr");
    var xhr = new XMLHttpRequest();
    xhr.open("GET", syntaxURL, true);
    xhr.onload = function () {
        if (xhr.response &&
            xhr.response.length &&
            xhr.responseText.indexOf("404 - The requested URL was not found.") > 0) {
            syntaxURL = "https://adblockplus.org/en/filters";
        }
        var data = {command: "filter_syntax_url", data: syntaxURL};
        require("port").chrome.extension.sendRequest(data);
    };
    xhr.onerror = function (err) {
        syntaxURL = "https://adblockplus.org/en/filters";
        var data = {command: "filter_syntax_url", data: syntaxURL};
        require("port").chrome.extension.sendRequest(data);
    };
    xhr.send();
};

//Get our information in XML format from the Mozilla Addon site (AMO).
var get_mozilla_amo_info = function() {
    var Request = require("sdk/request").Request;
    Request({
      url: "https://services.addons.mozilla.org/en-US/firefox/api/1.5/addon/532754",
      onComplete: function (response) {
        if (response &&
            response.text.length) {
            var data = { command: "amo_info", data: response.text};
            require("port").chrome.extension.sendRequest(data);
        }
      }
    }).get();
}
exports.get_mozilla_amo_info = get_mozilla_amo_info;
