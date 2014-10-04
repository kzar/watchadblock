$(document).ready(function() {
    // Check, whether update is available
    $("#checkupdate").html(translate("checkforupdates"));
    checkupdates("help");
    
    // Show the changelog
    $("#whatsnew a").click(function() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", chrome.extension.getURL("CHANGELOG.txt"), false);
        xhr.send();
        var object = xhr.responseText;
        $("#changes").text(object).css({width: "670px", height: "200px"}).fadeIn();
    });
});