var isApp = false;
(function() {
  if (SAFARI || !/eefkobgceabjladaefihncnghgdiilge/.test(chrome.extension.getURL('')))
    return;
  isApp = true;
  chrome.browserAction.setIcon = function() {};
  chrome.browserAction.setTitle = function() {};
  chrome.browserAction.setBadgeText = function() {};
  chrome.browserAction.setBadgeBackgroundColor = function() {};

  if (!localStorage.saw_appRetirement_popup) {
    chrome.windows.create({url:"app/app_EOL.html", type:"popup", width:600, height: 350, left: 200, top: 100});
    localStorage.setItem("saw_appRetirement_popup", true);
  }
})();