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
  this._clickWatcher.show();
}
BlacklistUi.prototype._build_page1 = function() {
  var that = this;

  var page = $("<div>" + translate("sliderexplanation") +
           "<br/><div id='slider'></div>" +
           "<div id='selected_data' style='font-size:smaller; height:7em'>" +
           "</div>" +
           "</div>");

  var btns = {};
  btns[translate("buttonlooksgood")] = 
      function() {
        that._cancelled = false;
        that._ui_page1.dialog('close');
        that._cancelled = true;
        that._redrawPage2();
        that._ui_page2.dialog('open');
      }
  btns[translate("buttoncancel")] = 
      function() {
        that._ui_page1.dialog('close');
        page.remove();
      }

  page.dialog({
      zIndex: 10000000, 
      position: [50, 50],
      width: 410,
      autoOpen: false,
      title: translate("slidertitle"),
      buttons: btns,
      close: function() {
        that._onClose();
      }
    }).css({
      'background': 'white',
      'text-align': 'left',
      'font-size': '12px',
    });

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
      max:Math.max(depth - 1, 1),
      slide: function(event, ui) {
        that._chain.moveTo(ui.value);
      }
    });

  return page;
}

BlacklistUi.prototype._build_page2 = function() {
  var that = this;
  
  var page = $("<div>" + translate("blacklisteroptions1") +
    "<div>" +
    "<div style='margin-left:15px' id='adblock-details'></div><br/>" +
    "<div style='background:#eeeeee;border: 1px solid #dddddd;" +
    " padding: 3px; font-style:italics;' id='count'></div>" +
    "</div>" +
    "<div>" +
    "<br/>" + translate("blacklisternotsure", ["<b>", "</b>"]) + "<br/>" +
    translate("blacklisterwanttohelp", 
              ["<b>", "</b>", "<a target='_new' id='adreportlink'>", "</a>"]) +
    "<br/></div>" +
    "<div style='clear:left; font-size:smaller'>" +
    "<br/>" + translate("blacklisterthefilter") +
    "  <div style='margin-left:15px;margin-bottom:15px'>" +
    "    <div>" +
    "      <div id='summary'></div><br/>" +
    "      <div id='filter_warning'></div>" +
    "    </div>" +
    "  </div>" +
    "</div>" +
    "</div>");

  var btns = {};
  btns[translate("buttonblockit")] =
      function() {
        if ($("#summary", that._ui_page2).text().length > 0) {
          var filter = document.domain + "##" + 
                       $("#summary", that._ui_page2).text();
          extension_call('add_custom_filter', { filter: filter }, function() {
            that._fire('block');
          });
        } else {alert(translate("blacklisternofilter"));}
      }
  btns[translate("buttoncancel")] =
      function() {
        that._ui_page2.dialog('close');
        page.remove();
      }
  btns[translate("buttonedit")] =
      function() {
        var custom_filter = document.domain + '##' + $("#summary", that._ui_page2).text();
        that._ui_page2.dialog('close');
        custom_filter = prompt(translate("blacklistereditfilter"), custom_filter);
        if (custom_filter.indexOf('##') == -1) 
          custom_filter = "##" + custom_filter;
        var valid_filter = global_filter_validation_regex.test(custom_filter);
        if (valid_filter && custom_filter != null &&
            custom_filter.indexOf('####') == -1) {
          extension_call('add_custom_filter', { filter: custom_filter }, function() {
            that._fire('block');
          });
        } else {
          if (custom_filter != null) //null => user clicked cancel
            alert(translate("blacklistereditinvalid"));
        }
        page.remove();
      }
  btns[translate("buttonback")] = 
      function() {
        that._cancelled = false;
        that._ui_page2.dialog('close');
        that._cancelled = true;
        that._redrawPage1();
        that._ui_page1.dialog('open');
      }

  page.dialog({
      zIndex:10000000, 
      position:[50, 50],
      width: 500,
      autoOpen: false,
      title: translate("blacklisteroptionstitle"),
      buttons: btns,
      close: function() {
        that._onClose();
      }
    }).css({
      'background': 'white',
      'text-align': 'left',
      'font-size': '12px',
    });

  return page;
}
BlacklistUi.prototype._redrawPage1 = function() {
  var el = this._chain.current();
  var text = '&lt;' + el[0].nodeName;
  var attrs = ["id", "class", "name", "src", "href"];
  for (var i in attrs) {
    var val = BlacklistUi._ellipsis(el.attr(attrs[i]));
    if (val != null && val != "") {
      text += ('<br/>&nbsp;&nbsp;' + attrs[i] + '="' + val + '"');
    }
  }
  text += ' &gt;';
  $("#selected_data", this._ui_page1).
    html("<b>" + translate("blacklisterblockedelement") + "</b><br/><i>" +
         text + "</i>");
}

// Return the CSS selector generated by the blacklister.  If the
// user has not yet gotten far enough through the wizard to
// determine the selector, return an empty string.
BlacklistUi.prototype._makeFilter = function() {
  var result = [];

  var el = this._chain.current();
  var detailsDiv = $("#adblock-details", this._ui_page2);

  if ($("input:checkbox#cknodeName", detailsDiv).is(':checked')) {
    result.push(el.attr('nodeName'));
    // Some iframed ads are in a bland iframe.  If so, at least try to
    // be more specific by walking the chain from the body to the iframe
    // in the CSS selector.
    if (el.attr('nodeName') == 'IFRAME' && el.attr('id') == '') {
      var cur = el.parent();
      while (cur.attr('nodeName') != 'BODY') {
        result.unshift(cur.attr('nodeName') + " ");
        cur = cur.parent();
      }
    }
  }
  var attrs = [ 'id', 'class', 'name', 'src', 'href' ];
  for (var i in attrs) {
    if ($("input:checkbox#ck" + attrs[i], detailsDiv).is(':checked'))
      result.push('[' + attrs[i] + '="' + el.attr(attrs[i]) + '"]');
  }

  var warningMessage;
  if (result.length == 0)
    warningMessage = translate("blacklisterwarningnofilter");
  else if (result.length == 1 && $("input:checkbox#cknodeName", detailsDiv).is(':checked'))
    warningMessage = translate("blacklisterblocksalloftype", result[0]);
  $("#filter_warning", this._ui_page2).
    css("display", (warningMessage ? "block" : "none")).
    css("font-weight", "bold").
    css("color", "red").
    text(warningMessage);
  return result.join('');
}

BlacklistUi.prototype._redrawPage2 = function() {

  var el = this._chain.current();
  var that = this;

  var detailsDiv = $("#adblock-details", that._ui_page2);

  var summary = $("#summary", that._ui_page2);

  function updateFilter() {
    summary.html(that._makeFilter());

    $("#adreportlink", that._ui_page2).
      attr("href", that._generatedAdReportUrl());

    var matchCount = $(summary.text()).length;
    $("#count", that._ui_page2).
      html("<center>" + ((matchCount == 1) ? 
          translate("blacklistersinglematch", ["<b>", "</b>"]) :
          translate("blacklistermatches", "<b>" + matchCount + "</b>")) 
          + "</center>");
  }

  detailsDiv.html("");
  var attrs = ['nodeName', 'id', 'class', 'name', 'src', 'href'];
  for (var i = 0; i < attrs.length; i++) {
    var attr = attrs[i];
    var val = BlacklistUi._ellipsis(el.attr(attr));

    if (val == '' || val == null)
      continue;

    var checkboxlabel = $("<span></span>").
      append(translate("blacklisterattrwillbe", 
          ["<b>" + (attr == 'nodeName' ? translate("blacklistertype") : attr) +
          "</b>", "<i>" + val + "</i>"])).
      css("cursor", "pointer").
      click(checkboxlabel_clicked);

    var checkbox = $("<div></div>").
      append("<input type=checkbox " + ((attr == 'src' || attr == 'href') ? 
             '': 'checked') + " id=ck" + attr + " /> ").
      append(checkboxlabel);

    checkbox.find("input").change(function() {
      updateFilter();
    });

    detailsDiv.append(checkbox);
  }

  updateFilter();
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

// Return a URL containing a prefilled ad report based on the current page
// and the filter they've attempted to create in the BlacklistUi.
BlacklistUi.prototype._generatedAdReportUrl = function() {
    return chrome.extension.getURL('adreport.html?from=blacklister&url=' +
         escape(location.href) + '&suggested=' + escape(this._makeFilter()));
}
