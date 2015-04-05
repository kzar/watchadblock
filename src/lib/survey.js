//if the ping reponse indicates a survey (tab or overlay)
//gracefully processes the request
SURVEY = (function() {
    var functions = require("functions");
    var ST = require("stats");
    var tabs = require("sdk/tabs");
    // Only allow one survey per browser startup, to make sure users don't get
    // spammed due to bugs in AdBlock / the ping server / the browser.
    var surveyAllowed = true;

    //open a Tab for a full page survey
    var processTab = function(surveyData) {

        var waitForUserAction = function() {
          tabs.removeListener("open", waitForUserAction);
          shouldShowSurvey(surveyData, function () {
              tabs.open('https://getadblock.com/' + surveyData.open_this_url);
          });
        };

        //since we can't check to see if an existing 'open' listener exists, we'll remove one.
        tabs.removeListener("open", waitForUserAction);
        tabs.on('open', waitForUserAction);
    }; //end of processTab()

    // Double check that the survey should be shown
    // Inputs:
    //   surveyData: JSON survey information from ping server
    //   callback(): called with no arguments if the survey should be shown
    var shouldShowSurvey = function(surveyData, callback) {
        var pingData = "cmd=survey" +
                       "&u=" + ST.STATS.userId +
                       "&sid=" + surveyData.survey_id;
        const { XMLHttpRequest } = require("sdk/net/xhr");
        var xhr = new XMLHttpRequest();
        xhr.open("POST", ST.STATS.statsUrl, true);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("Content-length", pingData.length);
        xhr.setRequestHeader("Connection", "close");
        xhr.onload = function () {
            if ((typeof xhr.responseText !== 'undefined') &&
                (xhr.responseText.length > 0))  {
                try {
                    var data = JSON.parse(xhr.responseText);
                } catch (e) {
                    functions.logging.log('Error parsing JSON: ', xhr.responseText, " Error: ", e);
                }
                if (data && 
                    data.should_survey === 'true' &&
                    surveyAllowed) {
                    surveyAllowed = false;
                    callback();
                }
            }
        };
        xhr.send(pingData);
  };

  // Check the response from a ping to see if it contains valid survey instructions.
  // If so, return an object containing data about the survey to show.
  // Otherwise, return null.
  // Inputs:
  //   responseData: string response from a ping
  var surveyDataFrom = function(responseData) {
      if (responseData.length === 0)
          return null;

      try {
          var surveyData = JSON.parse(responseData);
          if (!surveyData.open_this_url ||
              !surveyData.open_this_url.match ||
              !surveyData.open_this_url.match(/^\/survey\//)) {    
              functions.logging.log("bad survey data.", responseData);
              return null;
          }
      } catch (e) {
          functions.logging.log("Something went wrong with parsing survey data.");
          functions.logging.log('error', e);
          functions.logging.log('response data', responseData);
          return null;
      }
      return surveyData;
  };

  return {
      maybeSurvey: function(responseData) {
          if (require("background").get_settings().show_survey === false)
              return;

          var surveyData = surveyDataFrom(responseData);
          if (!surveyData)
              return;

          if (surveyData.type === 'tab')
              processTab(surveyData);
      }//end of maybeSurvey
  };
})();
exports.SURVEY = SURVEY;
