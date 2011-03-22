// Global lock so we can't open more than once on a tab.
if (typeof may_open_dialog_ui === "undefined")
    may_open_dialog_ui = true;

function verify_whitelist() {
  if (!may_open_dialog_ui)
    return;
  var domain = document.domain;

  // defined in blacklister.js
  load_jquery_ui(function() {
    may_open_dialog_ui = false;

    var btns = {};
    btns[translate("buttoncancel")] = function() { page.dialog('close');}
    btns[translate("buttonexclude")] = 
        function() {
          extension_call('add_custom_filter', 
                         {filter: '@@||' + domain + '^$document'}, function() {
            document.location.reload();
          });
        }

    var page = $("<div>").
      html("<div id='adblockslider'></div>" + translate("whitelistertext", [ domain ])).
      dialog({
        title: translate("whitelistertitle"),
        width: "300px",
        minHeight: 50,
        buttons: btns,
        close: function() {
          may_open_dialog_ui = true;
          page.remove();
        }
      });

    var domainparts = domain.split('.');
    if (domainparts[domainparts.length - 2] == "co") {
      var newTLD = domainparts[domainparts.length - 2] + "." +
          domainparts[domainparts.length - 1];
      domainparts.splice(domainparts.length - 2, 2, newTLD);
    }
    // Don't show the slider on 
    // - sites without a third level domain name (e.g. foo.com)
    // - sites with an ip domain (e.g. 1.2.3.4)
    var showSlider = !(domainparts.length == 2 || /^(\d+\.){3}\d+$/.test(domain));
    $("#adblockslider", page).
      css('margin', 10).
      css('display', showSlider ? "block" : "none").
      slider({
        min:0,
        max:Math.max(domainparts.length - 2, 1),
        slide: function(event, ui) {
          domain = '';
          for (var i = ui.value; i<=(domainparts.length - 2); i++) 
            domain += domainparts[i] + '.';
          domain += domainparts[domainparts.length - 1];
          $("i", page).text(domain);
        }
      });
  });
}


if (window == window.top)
  register_broadcast_listener('top_open_whitelist_ui', verify_whitelist);

// Safari context menu support, until we unify Chrome & Safari
// support via port.js
if (SAFARI) {
  // Handle right click menu item click
  safari.self.addEventListener("message", function(event) {
    if (event.name != "show-whitelist-wizard")
      return;
    page_broadcast('top_open_whitelist_ui', {});
  }, false);
}

