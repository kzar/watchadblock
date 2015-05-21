$(document).ready(function() {

    // Get debug info
    var debug_info = BGcall("getDebugInfo", function(info) {
        debug_info = info;
    });

    // Make a bug-report
    var report = BGcall("makeReport", function(info) {
        report = info;
    });

    // Check for updates
    $("#checkupdate").html(translate("checkforupdates"));
    checkupdates("help");

    if (navigator.language.substring(0, 2) != "en") {
        $(".english-only").css("display", "inline");
    }

    // Show debug info
    $("#debug").click(function(){
        var showDebugInfo = function() {
            $("#debugInfo").html(debug_info);
            $("#debugInfo").css({ width: "450px", height: "100px"});
            $("#debugInfo").fadeIn();            
        }
        if (SAFARI) {
            showDebugInfo();
        } else {
            chrome.permissions.request({
                permissions: ['management']
            }, function(granted) {
                // The callback argument will be true if the user granted the permissions.
                if (granted) {
                    chrome.management.getAll(function(result) {
                        var extInfo = [];
                        extInfo.push("==== Extension and App Information ====");
                        for (var i = 0; i < result.length; i++) {
                            extInfo.push("Number " + (i + 1));
                            extInfo.push("  name: " + result[i].name);
                            extInfo.push("  id: " + result[i].id);
                            extInfo.push("  version: " + result[i].version);
                            extInfo.push("  enabled: " + result[i].enabled)
                            extInfo.push("  type: " + result[i].type);
                            extInfo.push("");
                        }
                        debug_info = debug_info + '  \n  \n' + extInfo.join('  \n');
                        showDebugInfo();
                        chrome.permissions.remove({
                            permissions: ['management']
                        }, function(removed) {});
                    });
                } else {
                    debug_info = debug_info + "\n\n==== User Denied Extension and App Permissions ====";
                    showDebugInfo();
                }
            });
        }
    });

    // Report us the bug
    $("#report").click(function(){
        var result = "http://support.getadblock.com/discussion/new" +
        "?category_id=problems&discussion[body]=" + report;
        document.location.href = result;
    });

    // Show the changelog
    $("#whatsnew a").click(function() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.extension.getURL("CHANGELOG.txt"), false);
        xhr.send();
        var object = xhr.responseText;
        $("#changes").text(object).css({width: "670px", height: "200px"}).fadeIn();
    });
});
