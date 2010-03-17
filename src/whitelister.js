infinite_loop_workaround("whitelister");

var may_show_whitelist_ui = true;

function verify_whitelist() {
  if (!may_show_whitelist_ui)
    return;

  var domain = document.domain;
  // defined in blacklister.js
  load_jquery_ui(function() {

    stop_checking_for_whitelist_keypress();

    var page = $("<div></div>").
      html("AdBlock won't run on domains ending in<br/>'" + domain + "'.").
      dialog({
        title: "Whitelist this domain?",
        width: "auto",
        minHeight: 50,
        buttons: {
          "Cancel": function() { page.dialog('close'); },
          "Whitelist it!": function() {
            extension_call('add_to_whitelist', {domain:domain}, function() {
              document.location.reload();
            });
          }
        },
        close: function() {
          whitelister_init();
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
