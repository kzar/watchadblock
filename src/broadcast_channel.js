register_broadcast_listener = (function() {
  var dispatcher = {};
  var broadcaster_is_listening = false;

  function listen_for_broadcasts() {
    if (broadcaster_is_listening)
      return;
    broadcaster_is_listening = true;
    var port = chrome.extension.connect({name: "Broadcast receiver"});
    port.onMessage.addListener(function(request) {
      if (dispatcher[request.fn] == null) {
        log("No dispatch function '" + request.fn + "'");
      } else {
        dispatcher[request.fn](request.options);
      }
    });
  }

  function theFunction(function_name, listener) {
    listen_for_broadcasts();
    dispatcher[function_name] = listener;
  }

  return theFunction;
})();

// Broadcast to content scripts on our tab.
function page_broadcast(fn, options) {
  extension_call('emit_page_broadcast', {fn:fn, options:options});
}
