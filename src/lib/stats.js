"use strict";

// Allows interaction with the server to track install rate
// and log messages.
var STATS = (function () {
    var stats_url = "https://ping.getadblock.com/stats/";

    //Get some information about the version, os, and browser
    var os = require("sdk/system").platform;
    var osVersion = require("sdk/system").architecture;
    var flavor = "F";
    var version = require("firefox_bg").getFirefoxManifest().version;
    var browserVersion = require("sdk/system").version;

    var firstRun = !(require("functions").storage_get("userid"));

    // Give the user a userid if they don't have one yet.
    var userId = (function () {
        var time_suffix = (Date.now()) % 1e8; // 8 digits from end of timestamp

        if (!require("functions").storage_get("userid")) {
            var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
            var result = [];
            for (var i = 0; i < 8; i++) {
                var choice = Math.floor(Math.random() * alphabet.length);
                result.push(alphabet[choice]);
            }
            var theId = result.join('') + time_suffix;
            require("functions").storage_set("userid", theId);
        }

        return require("functions").storage_get("userid");
    })();

    // Tell the server we exist.
    var pingNow = function () {
        var pingData = "cmd=ping" +
            "&u=" + userId +
            "&v=" + version +
            "&f=" + flavor +
            "&o=" + os +
            "&g=" + (require("background").get_settings().show_google_search_text_ads ? '1' : '0') +
            "&l=" + require("functions").determineUserLanguage() +
            "&b=" + require("blockcounts").blockCounts.get().total;

        //if available, add the install Date to ping data
        var block_stats = require("functions").storage_get("blockage_stats");
        if (block_stats && block_stats.start) {
            pingData += "&i=" + block_stats.start;
        }
        const { XMLHttpRequest } = require("sdk/net/xhr");
        var xhr = new XMLHttpRequest();
        xhr.open("POST", stats_url, true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("Content-length", pingData.length);
        xhr.setRequestHeader("Connection", "close");
        xhr.onload = function () {
            handlePingResponse(xhr);
        };
        xhr.send(pingData);
    };//end of pingNow

    var handlePingResponse = function(xhr) {
        if ((typeof xhr.responseText !== 'undefined') &&
            (xhr.responseText.length > 0))  {
            require("survey").SURVEY.maybeSurvey(xhr.responseText);
        }
    };

    // Called just after we ping the server, to schedule our next ping.
    var scheduleNextPing = function () {
        var total_pings = require("functions").storage_get("total_pings") || 0;
        total_pings += 1;
        require("functions").storage_set("total_pings", total_pings);

        var delay_hours;
        if (total_pings == 1)      // Ping one hour after install
            delay_hours = 1;
        else if (total_pings < 9)  // Then every day for a week
            delay_hours = 24;
        else                       // Then weekly forever
            delay_hours = 24 * 7;

        var millis = 1000 * 60 * 60 * delay_hours;
        require("functions").storage_set("next_ping_time", Date.now() + millis);
    };//end of scheduleNextPing

    // Return the number of milliseconds until the next scheduled ping.
    var millisTillNextPing = function () {
        var next_ping_time = require("functions").storage_get("next_ping_time");
        if (!next_ping_time)
            return 0;
        else
            return Math.max(0, next_ping_time - Date.now());
    };//end of millisTillNextPing

    // Used to rate limit .message()s.  Rate limits reset at startup.
    var throttle = {
        // A small initial amount in case the server is bogged down.
        // The server will tell us the correct amount.
        max_events_per_hour: 3, // null if no limit
        // Called when attempting an event.  If not rate limited, returns
        // true and records the event.
        attempt: function () {
            var now = Date.now(), one_hour = 1000 * 60 * 60;
            var times = this._event_times, mph = this.max_events_per_hour;
            // Discard old or irrelevant events
            while (times[0] && (times[0] + one_hour < now || mph === null))
                times.shift();
            if (mph === null) return true; // no limit
            if (times.length >= mph) return false; // used our quota this hour
            times.push(now);
            return true;
        },
        _event_times: []
    };//end of throttle

    return {
        // True if AdBlock was just installed.
        firstRun: firstRun,
        userId: userId,
        version: version,
        flavor: flavor,
        browser: ({F: "Firefox"})[flavor],
        browserVersion: browserVersion,
        os: os,
        osVersion: osVersion,
        statsUrl: stats_url,

        // Ping the server when necessary.
        startPinging: function () {

            function sleepThenPing() {
                var delay = millisTillNextPing();
                var nextStuffTodo = function () {
                    pingNow();
                    scheduleNextPing();
                    sleepThenPing();
                };
                require('sdk/timers').setTimeout(nextStuffTodo, delay);
            };
            // Try to detect corrupt storage and thus avoid ping floods.
            if (!(millisTillNextPing() > 0)) {
                require("functions").storage_set("next_ping_time", 1);
                if (require("functions").storage_get("next_ping_time") != 1)
                    return;
            }
            // This will sleep, then ping, then schedule a new ping, then
            // call itself to start the process over again.
            sleepThenPing();

        },//end of startPinging

        // Record some data, if we are not rate limited.
        msg: function (message) {
            if (!throttle.attempt()) {
                return;
            }
            var data = "cmd=msg2" +
                "&m=" + message +
                "&u=" + userId +
                "&v=" + version +
                "&f=" + flavor +
                "&o=" + os +
                "&fr" + firstRun +
                "&bv" + browserVersion +
                "&ov" + osVersion;
            const { XMLHttpRequest } = require("sdk/net/xhr");
            var xhr = new XMLHttpRequest();
            xhr.open("POST", stats_url, true);
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr.setRequestHeader("Content-length", data.length);
            xhr.setRequestHeader("Connection", "close");
            xhr.onload = function () {
                var mph = parseInt(xhr.getResponseHeader("X-RateLimit-MPH"), 10);
                if (isNaN(mph) || mph < -1) // Server is sick
                    mph = 1;
                if (mph === -1)
                    mph = null; // no rate limit
                throttle.max_events_per_hour = mph;
            };
            xhr.send(data);
        }
    };//end of msg

})();
exports.STATS = STATS;