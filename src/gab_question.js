// Utlized on certain getadblock.com pages
// adds retry (reopen) logic when we don't
// get a repsonse from the user
// currently, on the 'gab.com/question' page
gabQuestion = (function() {
  var questionTab = null;
  var numQuestionAttempts = 0;
  var questionTabOpenInProgress = false;
  var questionURL = undefined;
  var oneMinute = 60 * 1000;
  //Question tab listeners - Chrome
  var onTabRemovedListener = function(tabId, removeInfo) {
    //check if the tab remove is the question tab,
    //if so, re-open it
    if (questionTab &&
        questionTab.id === tabId &&
        removeInfo &&
        !removeInfo.isWindowClosing) {
          openQuestionTab();
    }
  };
  var onTabUpdatedListener = function(tabId, changeInfo, tab) {
    //check if the tab updated is the question tab,
    //if so, re-open it
    if (questionTab &&
        questionTab.id === tabId &&
        tab &&
        tab.url !== questionTab.url) {
          openQuestionTab();
    }
  };
  //Question tab listeners - Safari
  var onTabCloseListener = function(event) {
    //called when the question tab is closed,
    //if so, re-open the question tab
    if (event &&
        event.type === "close") {
      openQuestionTab();
    }
  };
  var onTabNavigateListener = function(event) {
    //called when the user navigates to a different URL in the question tab
    //re-open the question tab
    if (event &&
        event.type === "navigate" &&
        event.target &&
        event.target.url &&
        event.target.url.lastIndexOf(questionURL, 0) !== 0) {
      openQuestionTab();
    }
  };
  //opens a new Tab, and returns a reference to the new tab.
  //similiar to openTab() in background.js,
  //but different in that a reference to the new tab is returned.
  var openNewSafariTab = function(tabURL) {
    var safariWindow = safari.application.activeBrowserWindow;
    if (safariWindow) {
        var newTab = safariWindow.openTab("foreground");
        if (!safariWindow.visible) {
            safariWindow.activate();
        }
    } else {
        var newTab = safari.application.openBrowserWindow().tabs[0];
    }
    newTab.url = tabURL;
    return newTab;
  };
  var openQuestionTab = function() {
    //already an open question tab in progress, don't need to open another
    if (questionTabOpenInProgress) {
      return;
    }
    questionTabOpenInProgress = true;
    //if we've already opened the 'question' tab 3 times,
    //and the user ignores us, give up
    if (numQuestionAttempts > 2) {
      removeGABTabListeners(true);
      return;
    } else {
      //remove the listeners, so we don't listen to wrong tab
      removeGABTabListeners();
    }
    numQuestionAttempts++;
    setTimeout(function() {
      questionTabOpenInProgress = false;
      if (SAFARI) {
          questionTab = openNewSafariTab(questionURL + "&a=" + numQuestionAttempts);
      } else {
        chrome.tabs.create({url: questionURL + "&a=" + numQuestionAttempts}, function(tab) {
          questionTab = tab;
        });
      }
    }, oneMinute);
  };
  //called from a content script when the retry/re-open logic is needed
  // Inputs: sender: object containing information about the source (tab) of the message
  var addGABTabListeners = function(sender) {
    //if the sender or any required property is null, log a message and return
    if (!sender || !sender.tab || !(sender.url || sender.tab.url)) {
      recordErrorMessage('question tab null');
      return;
    }
    if (storage_get('type-question')) {
      return;
    }
    if (!questionURL) {
      var tempURLObj = parseUri(sender.url || sender.tab.url);
      questionURL = tempURLObj.origin + tempURLObj.pathname + "?u=" + STATS.userId;
    }
    questionTab = undefined;
    if (chrome.tabs && chrome.tabs.onRemoved && chrome.tabs.onUpdated) {
      questionTab = sender.tab;
      chrome.tabs.onRemoved.addListener(onTabRemovedListener);
      chrome.tabs.onUpdated.addListener(onTabUpdatedListener);
    } else if (safari.application) {
      //find the 'question' tab
      var browserWindow = safari.application.activeBrowserWindow;
      if (browserWindow && browserWindow.tabs) {
        for (var i = 0; (i < browserWindow.tabs.length && questionTab === undefined); i++) {
          if (browserWindow.tabs[i].url === sender.tab.url &&
              browserWindow.tabs[i].id === sender.tab.id) {
            questionTab = browserWindow.tabs[i];
            questionTab.addEventListener("close", onTabCloseListener, true);
            questionTab.addEventListener("navigate", onTabNavigateListener, true);
          }
        }
      }
    }
  };
  //removes the listeners when a user navigates away, closes the tab, 
  //the user clicks a button on the page in question, or the number of retries were exceeded
  // Inputs: saveState:boolean if true (should only be true or undefined), save (persist)
  //         to storage the user answerred, or the number of retries were exceeded
  var removeGABTabListeners = function(saveState) {
    if (saveState) {
      storage_set('type-question',saveState);
    }
    if (chrome.tabs && chrome.tabs.onRemoved && chrome.tabs.onUpdated) {
      chrome.tabs.onRemoved.removeListener(onTabRemovedListener);
      chrome.tabs.onUpdated.removeListener(onTabUpdatedListener);
    } else if (questionTab.removeEventListener) {
      questionTab.removeEventListener("close", onTabCloseListener, true);
      questionTab.removeEventListener("navigate", onTabNavigateListener, true);
    }
  };

  return {
    addGABTabListeners: addGABTabListeners,
    removeGABTabListeners: removeGABTabListeners,
  };

})();