(function() {
  if (SAFARI || !/eefkobgceabjladaefihncnghgdiilge/.test(chrome.extension.getURL('')))
    return;

  chrome.browserAction.setIcon = function() {};
  chrome.browserAction.setTitle = function() {};
  chrome.browserAction.setBadgeText = function() {};
  chrome.browserAction.setBadgeBackgroundColor = function() {};

  chrome.windows.create({url:"app/app_EOL.html", type:"popup", width:400, height: 200});
})();
