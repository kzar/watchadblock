DataCollection = (function() {

  //setup memory cache  
  var dataCollectionCache = {};

  //if enabled, startup periodic saving of memory cache &
  //sending of data to the log server
  if (get_settings().data_collection) {
    window.setInterval(
      function() {
        idleHandler.scheduleItemOnce(function() {
            if (get_settings().data_collection &&
                Object.keys(dataCollectionCache).length > 0) {
              var data = JSON.stringify({ locale: determineUserLanguage(),
                                          filterStats: dataCollectionCache });
              recordAnonymousMessage(data, 'filter_stats');
              //reset memory cache
              dataCollectionCache = {};
            }
        });
      },
      60 * 60 * 1000
    );
  }

  return {
    addItem: function(filterText) {
      if (get_settings().data_collection) {
        if (filterText && (typeof filterText === "string")) {
          if (filterText in dataCollectionCache) {
            dataCollectionCache[filterText] = dataCollectionCache[filterText] + 1;
          } else {
            dataCollectionCache[filterText] = 1;
          }
        }
      }
    }
  }
})();