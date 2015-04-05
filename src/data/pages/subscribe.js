"use strict";

$(document).ready(function () {

    chrome.i18n.initializeL10nData(function () {
        // Translation
        localizePage();

        // When the subscription is finished or aborted
        function finished(success) {

            var message = (success ? translate("subscribingfinished") :
                translate("subscribingfailed"));
            $('#result').text(message);

            window.setTimeout(function () {
                    self.port.emit("close");
                }
                , success ? 2000 : 3500);
        }

        var listUrl = self.options;

        if (!/^https?\:\/\//i.test(listUrl)) {
            finished(false);
            return; // only should run on http/s pages
        }

        //Show the URL being subscribed.  If it's really long, make it wrap nicely.
        $('#listUrl').text(listUrl.replace(/(.{48,64}\W)/g, '$1 '));

        BGcall('get_subscriptions_minus_text', function (subs) {

            var sub = subs['url:' + listUrl];
            if (!sub || sub.last_update) {
                // It was a well known id, so assume it succeeded, or the
                // last_update property exists, so it succeeded
                finished(true);
            } else if (sub.last_update_failed_at)
                finished(false);
        });
    });//end of   initializeL10nData
});//end of document onReady
