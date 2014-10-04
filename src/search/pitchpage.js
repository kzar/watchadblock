function sendAction(action, value, needSubmit) {
  var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';
  chrome[runtimeOrExtension].sendMessage({pitch_page:action, value:value, needSubmit:needSubmit}, function(response){});
};

function modify_pitch_page() {
  var clicksIds = ['submit', 'nothanks', 'noPrivateSearch', 'yesPrivateSearch', 'learnmore', 'searchOmnibox', 'searchWebsite'];
  var loadIds = ["userPaid"];

  var element = window.document.getElementById('pageOptions');
  if (element) sendAction('pageOptions', element.value);

  clicksIds.forEach(function(entry) {
    var element = window.document.getElementById(entry);

    if (element) {
      if (element.id=='searchOmnibox' || element.id=='searchWebsite') {
        sendAction(element.id, element.checked, element.getAttribute('needSubmit'));
      }

      element.addEventListener('click', function(e) {
        sendAction(this.id, this.checked, this.getAttribute('needSubmit'));
      });
    }

  });

  loadIds.forEach(function(entry) {
    var element = window.document.getElementById(entry);
    if (element) {
        sendAction(element.id, true, element.getAttribute('needSubmit'));
    }
  });
};

modify_pitch_page();