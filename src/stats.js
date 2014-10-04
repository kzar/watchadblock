// Allows interaction with the server to track install rate
// and log messages.
STATS = (function() {
  var stats_url = "https://ping.getadblock.com/stats/";

  //Get some information about the version, os, and browser
  var version = (function() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", chrome.extension.getURL('manifest.json'), false);
    xhr.send();
    var manifest = JSON.parse(xhr.responseText);
    return manifest.version;
  })();
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

  // Tell the server we exist.
  var pingNow = function() {
    var data = {
      cmd: "ping",
      u: userId,
      v: version,
      f: flavor,
      o: os,
      g: get_settings().show_google_search_text_ads ? '1': '0',
    };

    $.post(stats_url, data
      , maybeSurvey // TODO: Remove when we no longer do a/b tests
    );
  };

  // TODO: Remove when we no longer do a/b tests
  var maybeSurvey = function(responseData) {
    if (responseData.length ===  0)
      return;
    console.log('Pinging got some data', responseData);

    try {
      var url_data = JSON.parse(responseData);
      if (!url_data.open_this_url.match(/^\/survey\//))
        throw "bad survey url.";
    } catch (e) {
      console.log("Something went wrong with opening a survey.");
      console.log('error', e);
      console.log('response data', responseData);
      return;
    }
    function one_time_opener() {
      if (SAFARI) {
        safari.application.removeEventListener("open", one_time_opener, true);
      } else {
        chrome.tabs.onCreated.removeListener(one_time_opener);
      }
      if (!one_time_opener.running)
        return; // one_time_opener was called multiple times
      one_time_opener.running = false;
      var open_the_tab = function() {
        openTab('https://getadblock.com/' + url_data.open_this_url, true);
      };
      if (SAFARI) {
        // Safari has a bug: if you open a new tab, it will shortly thereafter
        // set the active tab's URL to "Top Sites". However, here, after the
        // user opens a tab, we open another. It mistakenly thinks
        // our tab is the one the user opened and clobbers our URL with "Top
        // Sites."
        // To avoid this, we wait a bit, let it update the user's tab, then
        // open ours.
        window.setTimeout(open_the_tab, 500);
      } else {
        open_the_tab();
      }
    }
    one_time_opener.running = true;

    if (SAFARI) {
      safari.application.addEventListener("open", one_time_opener, true);
    } else {
      chrome.tabs.onCreated.addListener(one_time_opener);
    }
  };

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
    

    // Ping the server when necessary.
    startPinging: function() {
      function sleepThenPing() {
        var delay = millisTillNextPing();
        window.setTimeout(function() { 
          pingNow();
          scheduleNextPing();
          sleepThenPing();
        }, delay );
      };
      // Try to detect corrupt storage and thus avoid ping floods.
      if (millisTillNextPing() == 0) {
        storage_set("next_ping_time", 1);
        if (storage_get("next_ping_time") != 1)
          return;
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
      $.ajax(stats_url, {
        type: "POST",
        data: data, 
        complete: function(xhr) {
          var mph = parseInt(xhr.getResponseHeader("X-RateLimit-MPH"));
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
