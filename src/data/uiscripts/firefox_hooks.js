"use strict";

// This file is only loaded by Firefox.
//the listener for 'call' is done here, since the only scripts the recieve 'call's also use
//this script.
var myPort = ((typeof self !== 'undefined') && self.port) || ((typeof addon !== 'undefined') && addon.port);
if (typeof myPort !== 'undefined' && myPort) {
    myPort.on("call", function(request) {
        if (!request)
            return;

        chrome.i18n.initializeL10nData(function() {
            var fn = window[request.fn];
            if (typeof fn === 'undefined') {
                log("firefox_hooks - called function", request.fn, "but it was not found");
                return;
            }
            fn.apply(null, [request.options]);

        }, true);
    });

    myPort.on("detach", function() {
        wizardClosing();
    });
}

function wizardClosing() {
    if (typeof myPort !== 'undefined' && myPort) {
        myPort.emit("wizardClosing", "");
    }
}