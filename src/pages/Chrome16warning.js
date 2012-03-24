document.getElementById("link").addEventListener("click", function(e) {
  chrome.tabs.create({url: "chrome://extensions"});
  e.preventDefault();
}, false);
