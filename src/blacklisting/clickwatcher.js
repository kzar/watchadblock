// Requires overlay.js and jquery

// Class that watches the whole page for a click, including iframes and
// objects.  Shows a modal while doing so.
function ClickWatcher() {
  this._callbacks = { 'cancel': [], 'click': [] };
  this._clicked_element = null;
}
ClickWatcher.prototype.cancel = function(callback) {
  this._callbacks.cancel.push(callback);
}
ClickWatcher.prototype.click = function(callback) {
  this._callbacks.click.push(callback);
}
ClickWatcher.prototype._fire = function(eventName, arg) {
  var callbacks = this._callbacks[eventName];
  for (var i = 0; i < callbacks.length; i++)
    callbacks[i](arg);
}
ClickWatcher.prototype.show = function() {
  var that = this;
  var wait = $("<div></div>").
    append(translate("findingads")).
    css({
      'background': 'white',
      'text-align': 'left',
      'font-size': '12px',
    }).
    dialog({
      zIndex: 10000000, 
      position: [50, 50],
      height: 120,
      minHeight: 50,
      title: translate("blockanadtitle")
    });
  // setTimeout to give 'wait' a chance to display
  window.setTimeout(function() {
    that._ui = that._build_ui();
    wait.dialog('close');
    wait.remove();
    that._ui.dialog('open');
  }, 10);
}
// Called externally to close ClickWatcher.  Doesn't cause any events to
// fire.
ClickWatcher.prototype.close = function() {
  // Delete our event listeners so we don't fire any cancel events
  this._callbacks.cancel = [];
  if (this._ui) {
    this._ui.dialog('close');
  }
}
// The dialog is closing, either because the user clicked cancel, or the
// close button, or because they clicked an item.
ClickWatcher.prototype._onClose = function() {
  if (this._clicked_element == null) {
    // User clicked Cancel button or X
    this._fire('cancel');
  } else {
    // User clicked a page item
    this._fire('click', this._clicked_element);
  }
}
ClickWatcher.prototype._build_ui = function() { 
  var that = this;

  function click_catch_this() {
    return click_catch(this);
  }

  function click_catch(element) {
    that._clicked_element = element;
    that._ui.dialog('close');
    return false;
  }


  // Most things can be blacklisted with a simple click handler.
  $("*").
    not("body,html").         // Don't remove the body that the UI lives on!
    not("embed,object").      // Dealt with separately below
    click(click_catch_this);  // Everybody else, blacklist upon click

  // Send all objects and embeds to the background, and send any z-index
  // crazies to a lower z-index.  I'd do it here, but objects within iframes
  // will still block our click catchers over the iframes, so we have to tell
  // all subframes to do it too.
  page_broadcast('send_content_to_back', {});

  // Since iframes that will get clicked will almost always be an entire
  // ad, and I *really* don't want to figure out inter-frame communication
  // so that the blacklist UI's slider works between multiple layers of 
  // iframes... just overlay iframes and treat them as a giant object.
  $("object,embed,iframe,[onclick]:empty").
      each(function(i, dom_element) {
    var killme_overlay = new Overlay({
      dom_element: dom_element,
      click_handler: click_catch
    });
    killme_overlay.display();
  });

  var btn = {};
  btn[translate("buttoncancel")] = function() { page.dialog('close'); }

  // TODO: Why do I have to set this to be underline, blue, and pointer?
  // I can't figure out why it doesn't behave as a regular link.
  var link_to_block = $("<a>", {
    css: { 
      "text-decoration": "underline",
      "color": "blue",
      "cursor": "pointer",
      "font-size": "smaller !important"
    },
    text: translate("advanced_show_url_list"),
    // TODO: no need for the loop anymore
    click: function() { extension_call("emit_page_broadcast", {fn:'page_send_resources', options:{}}); }
  });

  var page = $("<div></div>").
      append(translate("clickthead")).
      append("<br/><br/>").
      append(link_to_block).
      css({
        'background': 'white',
        'text-align': 'left',
        'font-size': '12px',
      }).
      dialog({
          zIndex:10000000, 
          position:[50, 50],
          height:150,
          width:400,
          minHeight:50,
          autoOpen: false,
          title: translate("blockanadtitle"),
          buttons: btn,
          close: function() { 
            $("*").unbind('click', click_catch_this);
            Overlay.removeAll();
            that._onClose();
            page.remove();
          }
        });

  return page;
}
