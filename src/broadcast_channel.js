// TODO: Wrap in a typeof check to work around Chrome bug that makes
// adblock_start run multiple times on some pages (e.g. ebay.com homepage).  
if (typeof dispatcher == "undefined") {
  dispatcher = {};
  broadcaster_is_listening = false;
}
// Returns an object that you can define functions on.  Calls to
// extension_broadcast() will execute that function on all listeners.
function listen_for_broadcasts(portname) {
  if (broadcaster_is_listening)
    return;
  broadcaster_is_listening = true;
  port = chrome.extension.connect({name: portname || "Broadcast receiver"});
  port.onMessage.addListener(function(request) {
    if (dispatcher[request.fn] == null) {
      log("No dispatch function '" + request.fn + "'");
    } else {
      dispatcher[request.fn](request.options);
    }
  });
}

function register_broadcast_listener(function_name, listener) {
  dispatcher[function_name] = listener;
}

function broadcast(fn, options) {
  extension_call('emit_broadcast', {fn:fn, options:options});
}

// Like broadcast, but only send to content scripts on our tab.
function page_broadcast(fn, options) {
  extension_call('emit_page_broadcast', {fn:fn, options:options});
}
