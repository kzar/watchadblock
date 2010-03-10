infinite_loop_workaround("blacklistui");

// Requires clickwatcher.js and elementchain.js and jQuery

// Wizard that walks the user through clicking an ad, selecting an element,
// and choosing properties to block.
function BlacklistUi() {
  // If a dialog is ever closed without setting this to false, the
  // object fires a cancel event.
  this._cancelled = true;

  this._clickWatcher = new ClickWatcher();
  var that = this;
  this._clickWatcher.cancel(function() {
    that._fire('cancel');
  });
  this._clickWatcher.click(function(element) {
    that._chain = new ElementChain(element);
    that._last = that._chain.current();
    that._chain.change(that, that.handle_change);
    that._chain.change();

    that._ui_page1 = that._build_page1();
    that._ui_page2 = that._build_page2();
    that._redrawPage1();
    that._ui_page1.dialog('open');
  });

  this._callbacks = { 'cancel': [], 'block': [] };

  // TODO: makeEvent('cancel', 'click') and it sets up fns for us.
}
// TODO: same event framework as ClickWatcher
BlacklistUi.prototype.cancel = function(callback) {
  this._callbacks.cancel.push(callback);
}
BlacklistUi.prototype.block = function(callback) {
  this._callbacks.block.push(callback);
}
BlacklistUi.prototype._fire = function(eventName, arg) {
  var callbacks = this._callbacks[eventName];
  for (var i = 0; i < callbacks.length; i++)
    callbacks[i](arg);
}
BlacklistUi.prototype._onClose = function() {
  if (this._cancelled == true) {
    this._chain.current().show();
    this._fire('cancel');
  }
}
BlacklistUi.prototype.handle_change = function() {
  this._last.show();
  this._chain.current().hide();
  this._last = this._chain.current();
  this._redrawPage1();
  this._redrawPage2();
}
BlacklistUi.prototype.show = function() {
  var icon = chrome.extension.getURL("img/icon24.png");
  var css_chunk = document.createElement("style");
  css_chunk.innerText = ".ui-dialog-titlebar " +
      " { background: #2191C0 url(" + icon + ") " +
      " center left no-repeat !important; " +
      " padding-left: 38px !important; }";
  $("html").prepend(css_chunk);

  this._clickWatcher.show();
}
BlacklistUi.prototype._build_page1 = function() {
  var that = this;

  var page = $("<div>" +
           "Slide the slider until the ad is blocked correctly on the " +
           "page, and the blocked element looks useful.<br/>" +
           "<div id='slider'></div>" +
           "<div id='selected_data' style='font-size:smaller; height:7em'>" +
           "</div>" +
           "<div style='clear:left'>" +
           "  <input type=button value='Cancel' id='btnCancel1'/>" +
           "  <input type=button value='Looks Good' id='btnOk1'/>" +
           "</div>" +
           "</div>");
  page.dialog({
      zIndex:10000000, 
      position:[50, 50],
      width: 410,
      autoOpen: false,
      close: function() {
        that._onClose();
      }
    }).css({
      'background': 'white',
      'text-align': 'left',
      'font-size': '12px',
    });

  page.dialog('option', 'title', 'Step 1: Figure out what to block');

  var depth = 0;
  var guy = this._chain.current();
  while (guy.length > 0 && guy[0].nodeName != "BODY") {
    guy = guy.parent();
    depth++;
  }
  $("#slider", page).
    css('margin', 10).
    slider({
      min:0, 
      max:depth,
      slide: function(event, ui) {
        that._chain.moveTo(ui.value);
      }
    });

  $("#btnOk1", page).click(function() {
    that._cancelled = false;
    that._ui_page1.dialog('close');
    that._cancelled = true;
    that._redrawPage2();
    that._ui_page2.dialog('open');
  });

  $("#btnCancel1", page).click(function() {
    that._ui_page1.dialog('close');
  });

  return page;
}

BlacklistUi.prototype._build_page2 = function() {
  var that = this;
  
  var page = $("<div>" +
    "What do you think will be true about this ad every time you " +
    "visit this page?" +
    "<div>" +
    "<div style='margin-left:15px' id='adblock-details'></div><br/>" +
    "<div style='background:#eeeeee;border: 1px solid #dddddd;" +
    " padding: 3px; font-style:italics;' id='count'></div>" +
    "</div>" +
    "<div>" +
    "<br/><b>Not sure?</b> just press 'Block it!' below.<br/>" +
    "<b>Frustrated?</b> Just " +
    "<a id='giveup' style='text-decoration:underline'>report the ad</a> " +
    "instead and we'll take care of it!<br/>" +
    "<br/></div>" +
    "<div style='clear:left; font-size:smaller'>" +
    "Hey geeks: this is the filter, which you can change on the Options " +
    "page:" +
    "  <div style='margin-left:15px;margin-bottom:15px'>" +
    "    <div>" +
    "      <div id='summary'></div></i>" +
    "    </div>" +
    "  </div>" +
    "</div>" +
    "<div>" +
    "<input type=button value='Back' id='btnBack'/>" +
    "<input type=button value='Cancel' id='btnCancel2'/>" +
    "<input type=button value='Block it!' id='btnOk2'/>" +
    "</div>" +
    "</div>");

  page.dialog({
      zIndex:10000000, 
      position:[50, 50],
      width: 500,
      autoOpen: false,
      close: function() {
        that._onClose();
      }
    }).css({
      'background': 'white',
      'text-align': 'left',
      'font-size': '12px',
    });

  page.dialog('option', 'title', 'Last step: What makes this an ad?');

  $("#giveup", page).click(function() {
    var giveup = $("<div>").
      html("Let us know about the ad and we'll take care of it " +
           "for you and for thousands of other users.<br/><br/>" +
           "Describe the ad: <input id='txtGiveup' />").
      dialog({
        title: "Let us block the ad for you.",
        width: 400,
        buttons: {
          "Cancel": function() { giveup.dialog('close'); },
          "Report it!": function() {
            extension_call('get_subscriptions_minus_text', {}, 
                           function(subs) {
              var sub_names = "\n";
              for (var url in subs) {
                if (subs[url].subscribed)
                  sub_names += "  " + subs[url].name + "\n";
              }

              var url = "http://chromeadblock.com/reportad.php?url=";
              url += escape(document.location.href);
              url += "&frustrated=yes";
              url += "&comment=" + escape($("#txtGiveup").val());
              url += "&subscriptions=" + escape(sub_names);
              document.location.href = url;
            });
          }
        }
      });
    $("#txtGiveup").focus();
  });

  $("#btnBack", page).click(function() {
    that._cancelled = false;
    that._ui_page2.dialog('close');
    that._cancelled = true;
    that._redrawPage1();
    that._ui_page1.dialog('open');
  });

  $("#btnCancel2", page).click(function() {
    that._ui_page2.dialog('close');
  });

  $("#btnOk2", page).click(function() {
    var filter = {
      domain_regex: document.domain, // TODO option to specify
      css_regex: $("#summary", that._ui_page2).text()
    };
    extension_call('add_user_filter', { filter: filter }, function() {
      that._fire('block');
    });
  });

  return page;
}
BlacklistUi.prototype._redrawPage1 = function() {
  var el = this._chain.current();
  var text = '&lt;' + el[0].nodeName;
  var attrs = ["id", "class", "name", "src"];
  for (var i in attrs) {
    var val = BlacklistUi._ellipsis(el.attr(attrs[i]));
    if (val != null && val != "") {
      text += ('<br/>&nbsp;&nbsp;' + attrs[i] + '="' + val + '"');
    }
  }
  text += ' &gt;';
  $("#selected_data", this._ui_page1).
    html("<b>Blocked element:</b><br/><i>" + text + "</i>");
}
BlacklistUi.prototype._redrawPage2 = function() {

  var el = this._chain.current();
  var that = this;

  var detailsDiv = $("#adblock-details", that._ui_page2);

  var summary = $("#summary", that._ui_page2);

  function repaintSummary() {
    summary.html("");
    if ($("input:checkbox#cknodeName", detailsDiv).is(':checked')) {
      summary.append(el.attr('nodeName'));
      // Some iframed ads are in a bland iframe.  If so, at least try to
      // be more specific by walking the chain from the body to the iframe
      // in the CSS selector.
      if (el.attr('nodeName') == 'IFRAME' && el.attr('id') == '') {
        var cur = el.parent();
        while (cur.attr('nodeName') != 'BODY') {
          summary.prepend(cur.attr('nodeName') + " ");
          cur = cur.parent();
        }
      }
    }
    var attrs = [ 'id', 'class', 'name', 'src' ];
    for (var i in attrs) {
      if ($("input:checkbox#ck" + attrs[i], detailsDiv).is(':checked'))
        summary.append('[' + attrs[i] + '="' + el.attr(attrs[i]) + '"]');
    }

    var matchCount = $(summary.text()).length;
    $("#count", that._ui_page2).
      html("<center>That matches <b>" + matchCount + 
           (matchCount == 1 ? " item" : " items") + 
           "</b> on the page.</center>");
  }

  detailsDiv.html("");
  var attrs = ['nodeName', 'id', 'class', 'name', 'src'];
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i];
    var val = BlacklistUi._ellipsis(el.attr(attr));

    if (val == '' || val == null)
      continue;

    var checkbox = $("<div></div>").
      append("<input type=checkbox " + (attr == 'src' ? '': 'checked') + 
             " id=ck" + attr + " /> ").
      append("<b>" + (attr == 'nodeName' ? "Type" : attr) + 
             "</b> will be <i>" + val + "</i>");

    checkbox.find("input").change(function() {
      repaintSummary();
      var any = ($(summary.text()).length != 0);
      $("#btnOk2", that._ui_page2).attr("disabled", (any?null:"disabled"));

    });

    detailsDiv.append(checkbox);
  }

  repaintSummary();
}

// Return a copy of value that has been truncated with an ellipsis in
// the middle if it is too long.
// Inputs: value:string - value to truncate
//         size?:int - max size above which to truncate, defaults to 50
BlacklistUi._ellipsis = function(value, size) {
  if (value == null)
    return value;

  if (size == undefined)
    size = 50;

  var half = size / 2 - 2; // With ellipsis, the total length will be ~= size

  if (value.length > size)
    value = (value.substring(0, half) + "..." + 
             value.substring(value.length - half));

  return value;
}
