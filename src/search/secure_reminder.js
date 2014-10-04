var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';
var onceTime;

function getGoogleFormElement() {
 return window.document.getElementById("gbqf");
};

function isGoogle() {
  var formElement = getGoogleFormElement();
  return ((formElement!=undefined) && formElement.action.indexOf("/search")>=0) ? true : false;
};

function isGoogleSearch() {
  return (window.location.href.indexOf("/search")>=0);
};

function isInjected() {
  return (window.document.getElementById("search-alert")!=undefined) ? true : false;
};

function display() {
  chrome[runtimeOrExtension].sendMessage({action:'show_search_dialog'}, function(response) {});
  show_hide_msg(1);
};

function get_page() {
  chrome[runtimeOrExtension].sendMessage({action:'get_search_dialog_url'}, function(response) {
    $.get(response.search_dialog_url, function(html) {
      $("body").append(html);
      modify_pitch_page();
      if (isGoogleSearch()) display();
    });
  });
};

$(document).ready(function() {
  if (isInjected()) return;
  onceTime = 0;

  if (isGoogle()) {
    get_page();

    getGoogleFormElement().addEventListener('keyup', function(e) {
      if (e.keyCode < 48) return;
      if (onceTime != 0) return;

      onceTime++;
      try { display(); }catch(e){}
    });
  }
});