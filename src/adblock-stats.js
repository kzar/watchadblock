// Allows interaction with the server to track install rate
// and log messages.
STATS = (function()
{
  // Inputs: key:string.
  // Returns value if key exists, else undefined.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  storage_get = function(key) {
    var store = localStorage;
    if (store === undefined) {
        return undefined;
    }
    key = key + "_alt";
    var json = store.getItem(key);
    if (json == null)
      return undefined;
    try {
      return JSON.parse(json);
    } catch (ex) {
      if (ex && ex.message) {
        recordErrorMessage('storage_get error ' + ex.message);
      }
      return undefined;
    }
  };

  // Inputs: key:string, value:object.
  // Note: "_alt" is appended to the key to make it the key different
  // from the previous items stored in localstorage
  // If value === undefined, removes key from storage.
  // Returns undefined.
  storage_set = function(key, value) {
    var store = localStorage;
    key = key + "_alt";
    if (value === undefined) {
      store.removeItem(key);
      return;
    }
    try {
      store.setItem(key, JSON.stringify(value));
    } catch (ex) {

    }
  };

  var userIDStorageKey = "userid";
  var totalPingStorageKey = "total_pings";
  var nextPingTimeStorageKey = "next_ping_time";

  var stats_url = "https://ping.getadblock.com/stats/";

  var FiftyFiveMinutes = 3300000;

  // Get some information about the version, os, and browser
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

  var firstRun = false;

  var user_ID;

  // Give the user a userid if they don't have one yet.

  // Give the user a userid if they don't have one yet.
  var checkUserId = function()
  {
    var userIDPromise = new Promise(function(resolve)
    {
      ext.storage.get(STATS.userIDStorageKey, function(response)
      {
        var localuserid = storage_get(STATS.userIDStorageKey);
        if (!response[STATS.userIDStorageKey] && !localuserid)
        {
          STATS.firstRun = true;
          var time_suffix = (Date.now()) % 1e8; // 8 digits from end of
                                                // timestamp
          var alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
          var result = [];
          for (var i = 0; i < 8; i++)
          {
            var choice = Math.floor(Math.random() * alphabet.length);
            result.push(alphabet[choice]);
          }
          user_ID = result.join('') + time_suffix;
          // store in redudant locations
          ext.storage.set(STATS.userIDStorageKey, user_ID);
          storage_set(STATS.userIDStorageKey, user_ID);
        }
        else
        {
          user_ID = response[STATS.userIDStorageKey] || localuserid;
          if (!response[STATS.userIDStorageKey] && localuserid)
          {
            ext.storage.set(STATS.userIDStorageKey, user_ID);
          }
          if (response[STATS.userIDStorageKey] && !localuserid)
          {
            storage_set(STATS.userIDStorageKey, user_ID);
          }
        }
        resolve(user_ID);
      });
    });
    return userIDPromise;
  };

  ext.onMessage.addListener(function(message, sender, sendResponse)
  {
    if (message.command !== "get_adblock_user_id")
    {
      return;
    }
    checkUserId().then(function(userID)
    {
      sendResponse(userID);
    });
    return true;
  });

  var getPingData = function(callbackFN)
  {
    if (!callbackFN && (typeof callbackFN !== 'function'))
    {
      return;
    }
    ext.storage.get(STATS.totalPingStorageKey, function(response)
    {
      var localTotalPings = storage_get(STATS.totalPingStorageKey);
      var total_pings = response[STATS.totalPingStorageKey] || localTotalPings || 0;
      var data = {
        u : user_ID,
        v : version,
        f : flavor,
        o : os,
        bv : browserVersion,
        ov : osVersion,
        ad: getSettings().show_advanced_options ? '1': '0',
        l : determineUserLanguage(),
        st : SURVEY.types(),
        pc : total_pings,
        cb : getSettings().safari_content_blocking ? '1' : '0',
      };
      // only on Chrome
      if (flavor === "E" && Prefs.blocked_total)
      {
        data["b"] = Prefs.blocked_total;
      }
      if (chrome.runtime.id)
      {
        data["extid"] = chrome.runtime.id;
      }
      var subs = getAllSubscriptionsMinusText();
      if (subs["acceptable_ads"])
      {
        data["aa"] = subs["acceptable_ads"].subscribed ? '1' : '0';
      }
      else
      {
        data["aa"] = 'u';
      }
      callbackFN(data);
    });
  };
  // Tell the server we exist.
  var pingNow = function()
  {
    getPingData(function(data)
    {
      if (!data.u)
      {
        return;
      }
      // attempt to stop users that are pinging us 'alot'
      // by checking the current ping count,
      // if the ping count is above a theshold,
      // then only ping 'occasionally'
      if (data.pc > 5000)
      {
        if (data.pc > 5000 && data.pc < 100000 && ((data.pc % 5000) !== 0))
        {
          return;
        }
        if (data.pc >= 100000 && ((data.pc % 50000) !== 0))
        {
          return;
        }
      }
      data["cmd"] = 'ping';
      var ajaxOptions = {
        type : 'POST',
        url : stats_url,
        data : data,
        success : handlePingResponse, // TODO: Remove when we no longer do a/b
                                      // tests
        error : function(e)
        {
          console.log("Ping returned error: ", e.status);
        },
      };

      if (chrome.management && chrome.management.getSelf)
      {
        chrome.management.getSelf(function(info)
        {
          data["it"] = info.installType.charAt(0);
          $.ajax(ajaxOptions);
        });
      }
      else
      {
        $.ajax(ajaxOptions);
      }
    });
  };

  var handlePingResponse = function(responseData, textStatus, jqXHR)
  {
    SURVEY.maybeSurvey(responseData);
  };

  // Called just after we ping the server, to schedule our next ping.
  var scheduleNextPing = function()
  {
    ext.storage.get(STATS.totalPingStorageKey, function(response)
    {
      var localTotalPings = storage_get(totalPingStorageKey);
      var total_pings = response[STATS.totalPingStorageKey] || localTotalPings || 0;
      total_pings += 1;
      // store in redudant locations
      ext.storage.set(STATS.totalPingStorageKey, total_pings);
      storage_set(STATS.totalPingStorageKey, total_pings);

      var delay_hours;
      if (total_pings == 1) // Ping one hour after install
        delay_hours = 1;
      else if (total_pings < 9) // Then every day for a week
        delay_hours = 24;
      else
        // Then weekly forever
        delay_hours = 24 * 7;

      var millis = 1000 * 60 * 60 * delay_hours;
      var nextPingTime = Date.now() + millis;

      // store in redudant location
      ext.storage.set(STATS.nextPingTimeStorageKey, nextPingTime);
      storage_set(STATS.nextPingTimeStorageKey, nextPingTime);
    });
  };

  // Return the number of milliseconds until the next scheduled ping.
  var millisTillNextPing = function(callbackFN)
  {
    if (!callbackFN || (typeof callbackFN !== 'function'))
    {
      return;
    }
    // Wait 10 seconds to allow the previous 'set' to finish
    window.setTimeout(function() {
      ext.storage.get(STATS.nextPingTimeStorageKey, function(response)
      {
        var local_next_ping_time = storage_get(STATS.nextPingTimeStorageKey);
        var next_ping_time = response[STATS.nextPingTimeStorageKey] || local_next_ping_time || 0;
        // if this is the first time we've run (just installed), millisTillNextPing is 0
        if (next_ping_time === 0 && STATS.firstRun) {
          callbackFN(0);
        }
        // if we don't have a 'next ping time', or it's not a valid number,
        // default to 55 minute ping interval
        if (next_ping_time === 0 || isNaN(next_ping_time)) {
          callbackFN(FiftyFiveMinutes);
        } else {
          callbackFN(next_ping_time - Date.now());
        }
      });
    }, 10000);
  };

  // Used to rate limit .message()s. Rate limits reset at startup.
  var throttle = {
    // A small initial amount in case the server is bogged down.
    // The server will tell us the correct amount.
    max_events_per_hour : 3, // null if no limit
    // Called when attempting an event. If not rate limited, returns
    // true and records the event.
    attempt : function()
    {
      var now = Date.now(), one_hour = 1000 * 60 * 60;
      var times = this._event_times, mph = this.max_events_per_hour;
      // Discard old or irrelevant events
      while (times[0] && (times[0] + one_hour < now || mph === null))
        times.shift();
      if (mph === null)
        return true; // no limit
      if (times.length >= mph)
        return false; // used our quota this hour
      times.push(now);
      return true;
    },
    _event_times : []
  };

  return {
    userIDStorageKey : userIDStorageKey,
    totalPingStorageKey : totalPingStorageKey,
    nextPingTimeStorageKey : nextPingTimeStorageKey,
    // True if AdBlock was just installed.
    firstRun : firstRun,
    userId : function()
    {
      return user_ID;
    },
    version : version,
    flavor : flavor,
    browser : ({
      O : "Opera",
      S : "Safari",
      E : "Chrome"
    })[flavor],
    browserVersion : browserVersion,
    os : os,
    osVersion : osVersion,
    statsUrl : stats_url,
    userIdPromise : checkUserId,
    // Ping the server when necessary.
    startPinging : function()
    {
      function sleepThenPing()
      {
        millisTillNextPing(function(delay)
        {
          window.setTimeout(function()
          {
            pingNow();
            scheduleNextPing();
            sleepThenPing();
          }, delay);
        });
      };

      checkUserId().then(function(userID)
      {
        // Do 'stuff' when we're first installed...
        // - send a message
        ext.storage.get(STATS.totalPingStorageKey, function(response)
        {
          if (!response[STATS.totalPingStorageKey])
          {
            if (chrome.management && chrome.management.getSelf)
            {
              chrome.management.getSelf(function(info)
              {
                if (info)
                {
                  recordGeneralMessage('new install ' + info.installType);
                }
                else
                {
                  recordGeneralMessage('new install');
                }
              });
            }
            else
            {
              recordGeneralMessage('new install');
            }
          }
        });
      });
      // This will sleep, then ping, then schedule a new ping, then
      // call itself to start the process over again.
      sleepThenPing();
    },

    // Record some data, if we are not rate limited.
    msg : function(message)
    {
      if (!throttle.attempt())
      {
        log("Rate limited:", message);
        return;
      }
      var data = {
        cmd : "msg2",
        m : message,
        u : user_ID,
        v : version,
        fr : firstRun,
        f : flavor,
        bv : browserVersion,
        o : os,
        ov : osVersion
      };
      if (chrome.runtime.id)
      {
        data["extid"] = chrome.runtime.id;
      }
      $.ajax(stats_url, {
        type : "POST",
        data : data,
        complete : function(xhr)
        {
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
