var runtimeOrExtension = chrome.runtime && chrome.runtime.sendMessage ? 'runtime' : 'extension';

function sendAction(action, value, needSubmit) {
  chrome[runtimeOrExtension].sendMessage({pitch_page:action, value:value, needSubmit:needSubmit}, function(response){});
};

function put_extension_information() {
  var createElement = function(id, value) {
    var found = window.document.getElementById(id);
    if (!found) {
      var elemDiv = window.document.createElement("div");
      elemDiv.id = id;
      elemDiv.innerText = value;
      elemDiv.style.display = "none";
      window.document.body.appendChild(elemDiv);
    }
  };

  chrome[runtimeOrExtension].sendMessage({action:'get_extension_information'}, function(response) {
    createElement('adblock_user_id', response.user_id);
    createElement('adblock_group_id', response.group_id);
    createElement('adblock_ui', response.adblock_ui);
  });
};

function modify_pitch_page() {
  var clicksIds = ['submit', 'nothanks', 'noPrivateSearch', 'yesPrivateSearch', 'learnmore', 'searchOmnibox', 'searchWebsite', 'getExtSearch'];
  var loadIds = ['pageOptions', 'userPaid'];

  put_extension_information();
  loadIds.forEach(function(entry) {
    var element = window.document.getElementById(entry);
    if (element) {
      sendAction(element.id, element.value);
    }
  });

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
};

modify_pitch_page();