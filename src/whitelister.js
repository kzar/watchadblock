infinite_loop_workaround("whitelister");

var may_show_whitelist_ui = true;

function verify_whitelist() {
  if (!may_show_whitelist_ui)
    return;
  var domain = document.domain;

  // defined in blacklister.js
  load_jquery_ui(function() {
    stop_checking_for_whitelist_keypress();

    var page = $("<div>", {id: "adblock_whitelister"}).
      html("<div id='adblockslider'></div>" + 
        "AdBlock won't run on domains ending in<br/>" +
        "'<i id='adblockdomainname'>" + domain + "</i>'.").
      dialog({
        title: "Whitelist this domain?",
        width: "300px",
        minHeight: 50,
        buttons: {
          "Cancel": function() { page.dialog('close');},
          "Whitelist it!": function() {
            extension_call('add_to_whitelist', {domain:domain}, function() {
              document.location.reload();
            });
          }
        },
        close: function() {
          whitelister_init();
          page.remove();
        }
      });

    var domainparts = domain.split('.');
    $("#adblockslider", page).
      css('margin', 10).
      css('display', (domainparts.length == 2) ? "none" : "block").
      slider({
        min:0,
        max:Math.max(domainparts.length - 2, 1),
        slide: function(event, ui) {
          domain = '';
          for (var i = ui.value; i<=(domainparts.length - 2); i++) 
            domain += domainparts[i] + '.';
          domain += domainparts[domainparts.length - 1];
          $("#adblockdomainname", page).
            text(domain);
        }
      });
  });
}

function stop_checking_for_whitelist_keypress() {
  may_show_whitelist_ui = false;
  $("body").unbind('keydown', check_for_whitelist_keypress);
}

function check_for_whitelist_keypress(e) {
  if (e.ctrlKey && e.shiftKey && e.keyCode == 76) { // L
    extension_call('get_optional_features', {}, function(features) {
      if (features.whitelist_shortcut.is_enabled)
        verify_whitelist();
    });
  }
}

function whitelister_init() {
  may_show_whitelist_ui = true;
  $("body").keydown(check_for_whitelist_keypress);
}

if (window == window.top) {
  listen_for_broadcasts();
  register_broadcast_listener('top_open_whitelist_ui', verify_whitelist);
}
