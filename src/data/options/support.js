"use strict";

// Set up variables
var l10n_data = {};

// Check if amoVersion is newer than extVersion
var isNewerVersion = function(extVersion, amoVersion) {
    if (!amoVersion || !extVersion)
        return false;
    var amoVersionInfo = amoVersion.split('.');
    var extVersionInfo = extVersion.split('.');
    if (!amoVersionInfo || !extVersionInfo)
        return false;
    var minLength = Math.min(amoVersionInfo.length, extVersionInfo.length);
    for (var i=0; i<minLength; i++) {
        if (Number(amoVersionInfo[i]) > Number(extVersionInfo[i])) {
            return true;
        }
        if (Number(amoVersionInfo[i]) < Number(extVersionInfo[i])) {
            return false;
        }
    }
    //Check the length to handle the scenario when ext = 2.0 and amo = 2.0.1
    return (amoVersionInfo.length > extVersionInfo.length);
}

// Create a bug report
var makeReport = function () {
    var body = [];
    body.push(chrome.i18n.getMessage("englishonly") + "!");
    body.push("");
    body.push("** Please answer the following questions so that we can process your bug report, otherwise, we may have to ignore it. **");
    body.push("Also, please put your name, or a screen name, and your email above so that we can contact you if needed.");
    body.push("If you don't want your report to be made public, check that box, too.");
    body.push("");
    body.push("**Can you provide detailed steps on how to reproduce the problem?**");
    body.push("");
    body.push("1. ");
    body.push("2. ");
    body.push("3. ");
    body.push("");
    body.push("**What should happen when you do the above steps**");
    body.push("");
    body.push("");
    body.push("**What actually happened?**");
    body.push("");
    body.push("");
    body.push("**Do you have any other comments? If you can, can you please attach a screenshot of the bug?**");
    body.push("");
    body.push("");
    body.push("--- The questions below are optional but VERY helpful. ---");
    body.push("");
    body.push("If unchecking all filter lists fixes the problem, which one filter" +
    "list must you check to cause the problem again after another restart?");
    body.push("");
    body.push("====== Do not touch below this line ======");
    body.push("");

    var out = encodeURIComponent(body.join('  \n'));
    return out;
};//end of makeReport

var supportInit = function () {

    l10n_data = chrome.i18n.getL10nData();

    if ((typeof navigator.language !== 'undefined') &&
        navigator.language &&
        navigator.language.substring(0, 2) != "en") {
        $(".english-only").css("display", "inline");
    } else {
        $(".english-only").css("display", "none");
    }

    // Show debug info
    $("#debug").click(function () {
        BGcall("getDebugInfo", function (info) {
            $("#debugInfo").text(info).css({width: "450px", height: "100px"}).fadeIn();
        });
    });
    //disable the context menu, so that user's don't open the link's on new tabs, windows, etc.
    document.getElementById("debug").oncontextmenu = function () {
        return false;
    };

    //remove the href='#' attribute from any anchor tags, this oddly disables the middle click issues
    $("a[href='#']").removeAttr("href").css("cursor", "pointer");

    // Report us the bug
    $("#report").click(function () {
        BGcall("getDebugInfo", function (info) {
            var out = makeReport();
            var result = "http://support.getadblock.com/discussion/new" +
                "?category_id=problems&discussion[body]=" + out + encodeURIComponent('\n' + info);
            document.location.href = result;
        });
    });
    //disable the context menu, so that user's don't open the link's on new tabs, windows, etc.
    document.getElementById("report").oncontextmenu = function () {
        return false;
    };

    // Show the changelog
    $("#whatsnew a").click(function () {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "../CHANGELOG.txt");
            xhr.onload = function () {
                $("#changes").text(xhr.responseText).css({width: "670px", height: "200px"}).fadeIn();
            };
            xhr.send();
        } catch (ex) {
            //file not found, send back empty object;
        }
    });
    var checkUpdateEl = $("#checkupdate");
    checkUpdateEl.text(translate("checkforupdates"));
    chrome.extension.onRequest.addListener(function(request, sender) {
        if (request.command === "amo_info" &&
            request.data) {
            var amo_info = $.parseXML(request.data);
            var amo_version = $(amo_info).find('version').text();
            if (amo_version) {
                BGcall("getFirefoxManifest", function(manifest) {
                    if (isNewerVersion(manifest.version, amo_version)) {
                        checkUpdateEl.text(translate("ff_adblock_outdated"));
                    } else {
                        checkUpdateEl.text(translate("latest_version"));
                    }
                });
            }
        }
    });
    BGcall("get_mozilla_amo_info");
};