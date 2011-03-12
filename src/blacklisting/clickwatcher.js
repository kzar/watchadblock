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


  // Send all objects and embeds to the background, and send any z-index
  // crazies to a lower z-index.  I'd do it here, but objects within iframes
  // will still block our click catchers over the iframes, so we have to tell
  // all subframes to do it too.
  var opts = {
    selectors: ':not(#ui-adblock-clickwatcher)'
  };
  page_broadcast('send_content_to_back', opts);

  // Since iframes that will get clicked will almost always be an entire
  // ad, and I *really* don't want to figure out inter-frame communication
  // so that the blacklist UI's slider works between multiple layers of
  // iframes... just overlay iframes and treat them as a giant object.
  var body_overlay = new Overlay({
    dom_element: $("body"),
    placeholders: "iframe,embed,object:not(:has(object)|:has(embed)),[onclick]:empty",
    click_handler: click_catch
  });
  body_overlay.enable();

  var btn = {};
  btn[translate("buttoncancel")] = function() { page.dialog('close'); }

  var page = $("<div></div>").
    append(translate("clickthead")).
    append("<br/><br/>").
    css({
      'background': 'white',
      'text-align': 'left',
      'font-size': '12px',
    }).
    dialog({
      zIndex:10000000,
      position:[50, 50],
      width:400,
      minHeight:125,
      autoOpen: false,
      title: translate("blockanadtitle"),
      buttons: btn,
      close: function() {
        Overlay.removeAll();
        that._onClose();
        page.remove();
      },
      drag: function() {
        body_overlay.disable();
      }
    });
    page.dialog("widget").
      attr("id", "ui-adblock-clickwatcher").
      css("position", "fixed").
      bind("mouseenter",function() {
        body_overlay.disable();
      }).
      bind("mouseleave",function() {
        body_overlay.enable();
      });

  if (!SAFARI) {
    var link_to_block = $("<a>", {
      href: "#",
      tabIndex: -1,
      css: { "font-size": "smaller !important" },
      text: translate("advanced_show_url_list"),
      click: function(e) {
        // GLOBAL_collect_resources is created by adblock_start.js
        var resources = Object.keys(GLOBAL_collect_resources);
        extension_call("show_resourceblocker", {resources: resources});
        e.preventDefault();
        return false;
      }
    });
    page.append(link_to_block);
  }

  return page;
}
