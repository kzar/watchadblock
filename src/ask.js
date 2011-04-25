if (SAFARI) { (function() {
  var daysUntilFirstAsk = 7;

  var asker = {
    // Set the "ask timer" for some number of days ahead.
    setAskTimer: function(days) {
      // Just installed
      localStorage['next_ask'] = JSON.stringify(new Date().setDays(new Date().getDays() + days);
    },

    // If it's time to ask, do so.
    check: function() {
      if (asker.justLaunched() && asker.timeToAsk()) {
        asker.setAskTimer(30); // every month unless user request otherwise
        asker.ask();
      }
    },

    // Returns true if we are running upon browser start,
    // as opposed to upon install or upon extension update.
    justLaunched: function() {
      var lastVersion = localStorage['last_known_version']; // may be null
      var thisVersion = ADBLOCK.manifest.version;
      localStorage['last_known_version'] = thisVersion;
      // If the versions mismatch, we just installed or just updated.
      // If they match, this is the second startup with the same
      // version number, which means we just launched.
      return (lastVersion == thisVersion);
    },

    // Returns true if the "ask timer" has gone off.
    timeToAsk: function() {
      if (localStorage['next_ask'] == null) {
        asker.setAskTimer(7);
        return false;
      }
      return +new Date() > asker.next;
    },

    ask: function() {
      chrome.tabs.create({url: chrome.extension.getURL('ask.html')});
    }

  };
  asker.check();
})(); }
