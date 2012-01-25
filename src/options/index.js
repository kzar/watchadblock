function load_options() {
  // Check or uncheck each option.
  BGcall("get_settings", function(settings) {
    optionalSettings = settings;
    $("#tabpages").
      tabs({ 
        spinner: "",
        cache: true,
        cookie: {},
        load: function(event, ui) {
          //translation
          localizePage();

          $(".advanced").toggle(optionalSettings.show_advanced_options);
          $(".chrome-only").toggle(!SAFARI);

          // Must load tab .js here: CSP won't let injected html inject <script>
          var scriptToLoad = ui.tab.dataset.script; // see index.html:data-script
          // CSP blocks eval, which $().append(scriptTag) uses
          var s = document.createElement("script");
          s.src = scriptToLoad;
          document.body.appendChild(s);
        },
      }).
      show();
  });
}
var optionalSettings = {};
load_options();

function displayVersionNumber() {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", chrome.extension.getURL('manifest.json'), true);
    xhr.onreadystatechange = function() {
      if(this.readyState == 4) {
        var theManifest = JSON.parse(this.responseText);
        $("#version_number").text(translate("optionsversion", [theManifest.version]));
      }
    };
    xhr.send();
  } catch (ex) {} // silently fail
}

$(function() {
  displayVersionNumber();

  if (navigator.language.substring(0, 2) != "en")
    $("#translation_credits").text(translate("translator_credit"));

  //translation
  localizePage();
});




$(function() {
  if (SAFARI && LEGACY_SAFARI) {
    $("#safari50_updatenotice").show();
  }

  $('#paymentlink').click(function() {
    BGcall("storage_get", "userid", function(userId) {
      var href = "http://chromeadblock.com/pay/?source=O&u=" + userId;
      if (SAFARI) {
        // Safari target=_blank opens a new window by default, so we have to force its
        // height to be correct.
        window.open(href, "payment", 'location=0,status=0,scrollbars=0,width=800,height=550');
      } else {
        BGcall("openTab", href);
      }
    });
    return false;
  });
});
