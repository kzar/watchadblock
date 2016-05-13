// Allows interaction with the server to track install rate
// and log messages.
STATS = (function() {
  var stats_url = "https://ping.getadblock.com/stats/";

  //Get some information about the version, os, and browser
  var version = chrome.runtime.getManifest().version;
  var match = navigator.userAgent.match(/(CrOS\ \w+|Windows\ NT|Mac\ OS\ X|Linux)\ ([\d\._]+)?/);
  var os = (match || [])[1] || "Unknown";
  var osVersion = (match || [])[2] || "Unknown";
  var flavor;
  if (window.opr)
    flavor = "O"; // Opera
  else if (window.safari)
    flavor = "S"; // Safari
  else
    flavor = "E"; // Chrome
  if (flavor === "O")
    match = navigator.userAgent.match(/(?:OPR)\/([\d\.]+)/);
  else
    match = navigator.userAgent.match(/(?:Chrome|Version)\/([\d\.]+)/);
  var browserVersion = (match || [])[1] || "Unknown";

  var firstRun = !storage_get("userid");

  // Give the user a userid if they don't have one yet.
  var userId = (function() {
    var time_suffix = (Date.now()) % 1e8; // 8 digits from end of timestamp

    if (!storage_get("userid")) {
      var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
      var result = [];
      for (var i = 0; i < 8; i++) {
        var choice = Math.floor(Math.random() * alphabet.length);
        result.push(alphabet[choice]);
      }
      var theId = result.join('') + time_suffix;

      storage_set("userid", theId);
    }

    return storage_get("userid");
  })();

  var getPingData = function() {
    var total_pings = storage_get("total_pings") || 0;
    var data = {
      u: userId,
      v: version,
      f: flavor,
      o: os,
      bv: browserVersion,
      ov: osVersion,
      ad: get_settings().show_advanced_options ? '1': '0',
      l: determineUserLanguage(),
      st: SURVEY.types(),
      pc: total_pings,
      cb: get_settings().safari_content_blocking ? '1': '0',
    };
    //only on Chrome
    if (flavor === "E" && blockCounts) {
        var bc = blockCounts.get();
        data["b"] = bc.total;
        data["mt"] = bc.malware_total;
    }
    if (chrome.runtime.id) {
      data["extid"] = chrome.runtime.id;
    }
    var subs = get_subscriptions_minus_text();
    if (subs["acceptable_ads"]) {
      data["aa"] = subs["acceptable_ads"].subscribed ? '1': '0';
    } else {
      data["aa"] = 'u';
    }
    return data;
  };
  // Tell the server we exist.
  var pingNow = function() {
    var data = getPingData();
    data["cmd"] = 'ping';
    var ajaxOptions = {
      type: 'POST',
      url: stats_url,
      data: data,
      success: handlePingResponse, // TODO: Remove when we no longer do a/b tests
      error: function(e) {
        console.log("Ping returned error: ", e.status);
      },
    };
    // attempt to stop users that are pinging us 'alot'
    // by checking the current ping count,
    // if the ping count is above a theshold,
    // then only ping 'occasionally'
    if (data.pc > 5000)
    {
      if (data.pc > 5000 &&
          data.pc < 100000 &&
          ((data.pc % 5000) !== 0))
      {
        return;
      }
      if (data.pc >= 100000 &&
         ((data.pc % 50000) !== 0))
      {
        return;
      }
    }
    if (chrome.management && chrome.management.getSelf) {
      chrome.management.getSelf(function(info) {
        data["it"] = info.installType.charAt(0);
        $.ajax(ajaxOptions);
      });
    } else {
      $.ajax(ajaxOptions);
    }
  };
  //tell the server we've started
  var adminPing = function() {
    var data = getPingData();
    data["cmd"] = 'adminping';
    //hard code the 'admin' type
    data["it"] = 'a';
    $.ajax({
      type: 'POST',
      url: stats_url,
      data: data,
      success: handlePingResponse, // TODO: Remove when we no longer do a/b tests
      error: function(e) {
        console.log("Ping returned error: ", e.status);
      },
    });
  };

  var handlePingResponse = function(responseData, textStatus, jqXHR) {
    SURVEY.maybeSurvey(responseData);
  };

  //after installation; for 'admin' installation, do a ping at start up.
  if (!firstRun && chrome.management && chrome.management.getSelf) {
    chrome.management.getSelf(function(info) {
      if (info && info.installType === "admin") {
        adminPing();
      }
    });
  }

  // Called just after we ping the server, to schedule our next ping.
  var scheduleNextPing = function() {
    var total_pings = storage_get("total_pings") || 0;
    total_pings += 1;
    storage_set("total_pings", total_pings);

    var delay_hours;
    if (total_pings == 1)      // Ping one hour after install
      delay_hours = 1;
    else if (total_pings < 9)  // Then every day for a week
      delay_hours = 24;
    else                       // Then weekly forever
      delay_hours = 24 * 7;

    var millis = 1000 * 60 * 60 * delay_hours;
    storage_set("next_ping_time", Date.now() + millis);
  };

  // Return the number of milliseconds until the next scheduled ping.
  var millisTillNextPing = function() {
    var next_ping_time = storage_get("next_ping_time");
    if (!next_ping_time)
      return 0;
    else
      return Math.max(0, next_ping_time - Date.now());
  };

  // Used to rate limit .message()s.  Rate limits reset at startup.
  var throttle = {
    // A small initial amount in case the server is bogged down.
    // The server will tell us the correct amount.
    max_events_per_hour: 3, // null if no limit
    // Called when attempting an event.  If not rate limited, returns
    // true and records the event.
    attempt: function() {
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
  };

  return {
    // True if AdBlock was just installed.
    firstRun: firstRun,
    userId: userId,
    version: version,
    flavor: flavor,
    browser: ({O:"Opera", S:"Safari", E:"Chrome"})[flavor],
    browserVersion: browserVersion,
    os: os,
    osVersion: osVersion,
    statsUrl: stats_url,
    // Ping the server when necessary.
    startPinging: function() {
      function sleepThenPing() {
        // Wait 10 seconds to allow the previous 'set' to finish
        window.setTimeout(function() {
          var delay = millisTillNextPing();
          window.setTimeout(function() {
            pingNow();
            scheduleNextPing();
            sleepThenPing();
          }, delay );
        }, 10000 );
      };
      // Try to detect corrupt storage and thus avoid ping floods.
      if (! (millisTillNextPing() > 0) ) {
        storage_set("next_ping_time", 1);
        if (storage_get("next_ping_time") != 1)
          return;
      }
      //if this is the first time we've run,
      //send a message
      if (firstRun && !storage_get("total_pings")) {
        if (chrome.management && chrome.management.getSelf) {
          chrome.management.getSelf(function(info) {
            if (info) {
              recordGeneralMessage('new install ' + info.installType);
            } else {
              recordGeneralMessage('new install');
            }
          });
        } else {
          recordGeneralMessage('new install');
        }
      }
      // This will sleep, then ping, then schedule a new ping, then
      // call itself to start the process over again.
      sleepThenPing();
    },

    // Record some data, if we are not rate limited.
    msg: function(message) {
      if (!throttle.attempt()) {
        log("Rate limited:", message);
        return;
      }
      var data = {
        cmd: "msg2",
        m: message,
        u: userId,
        v: version,
        fr: firstRun,
        f: flavor,
        bv: browserVersion,
        o: os,
        ov: osVersion
      };
      if (chrome.runtime.id) {
        data["extid"] = chrome.runtime.id;
      }
      $.ajax(stats_url, {
        type: "POST",
        data: data,
        complete: function(xhr) {
          var mph = parseInt(xhr.getResponseHeader("X-RateLimit-MPH"), 10);
          if (isNaN(mph) || mph < -1) // Server is sick
            mph = 1;
          if (mph === -1)
            mph = null; // no rate limit
          throttle.max_events_per_hour = mph;
        }
      });
    }
  };

})();