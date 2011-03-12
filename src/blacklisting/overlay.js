// Overlay
// Highlight DOM elements with an overlayed box, similar to Webkit's inspector.
// Creates an absolute-positioned div that is translated & scaled following
// mousemove events. Holds a reference to target DOM element.
// Inputs:
//   placeholders:string? cover nodes using div placeholders (e.g., "iframe,embed,object")
//   click_handler:function click callback
//   dom_element:DOMElement parent that will contain this overlay
Overlay = function(options) {
  Overlay.instances.push(this);
  this._then = +new Date();
  this._defaultZIndex = 1e6;
  this._enabled = false;
  this._tooltip = null;
  this._target = null;
  this._box = null;
  this._delay = 25;
  this._child_overlays = [];
  this._placeholder_target_names = options.placeholders;
  this._click_handler = options.click_handler;
  this._element = $(options.dom_element);
  this._init();
}

// Given a DOM element, return a filter string composed of nodeName, id
// and class attributes.
// Input: el:DOMElement node to extract props from
// Returns: filter string (i.e., "div#main.top_panel.advert")
Overlay.elementToFilterString = function(el) {
  var str = el.localName +
    (el.id ? "#" + el.id : "") +
    (el.className ? "." + $.trim(el.className).split(" ").join(".") : "");
  return str;
}

// Creates main overlay for the associated subtree, a tooltip, and placeholders
// for nodes such as iframes.
Overlay.prototype._init = function() {
  this._tooltip = $("<div class='adblock-highlight-tooltip'>&nbsp;</div>").
    css({
      font: "normal normal normal 12px/normal Sans serif, Verdana, Arial !important",
      backgroundColor: "#FFFFAA !important",
      outline: "solid 1px #000 !important",
      boxSizing: "border-box !important",
      position: "absolute !important",
      whiteSpace: "nowrap !important",
      textShadow: "none !important",
      lineHeight: "18px !important",
      padding: "0px 3px !important",
      cursor: "inherit !important",
      color: "#000 !important"
    });

  this._box = $("<div class='adblock-highlight-node'></div>").
    css({
      backgroundColor: "rgba(130, 180, 230, 0.5) !important",
      outline: "solid 1px #13589c !important",
      boxSizing: "border-box !important",
      position: "absolute !important",
      cursor: "default !important",
      display: "none"
    }).
    append(this._tooltip).
    appendTo(this._element).
    click($.proxy(this._mouseclick_handler, this));

  if (this._placeholder_target_names) {
    var that = this, offset, overlay, position;
    $(this._placeholder_target_names, this._element).
      each(function(i, el) {
        el = $(el);
        offset = el.position();
        position = el.css("position");
        overlay = $("<div class='adblock-killme-overlay'></div>").
          css({
            zIndex: (parseInt(el.css("z-index")) || that._defaultZIndex) + " !important",
            position: (position === "fixed" ? position : "absolute") + " !important",
            backgroundColor: "transparent !important",
            height: el.height(),
            width: el.width(),
            left: offset.left,
            top: offset.top
          }).
          appendTo(el.parent());
        that._child_overlays.push(overlay);
      });
  }
}

// Issues callback response when overlay is clicked
Overlay.prototype._mouseclick_handler = function(e) {
  this._click_handler(this._target[0]);
}

// Saves a reference to highlighted DOM element. Adjusts overlay and tooltip,
// and sets tooltip info.
Overlay.prototype._mousemove_handler = function(e) {
  var now = +new Date();
  if (now - this._then < this._delay)
    return;
  this._then = now;

  var el = e.target;
  if (el === this._box[0] || el === this._tooltip[0]) {
    this._box.hide();
    el = document.elementFromPoint(e.clientX, e.clientY);
  }
  if (el.className === "adblock-killme-overlay") {
    var temp = $(el);
    temp.hide();
    el = document.elementFromPoint(e.clientX, e.clientY);
    temp.show();
  }
  if (el === document.documentElement || el === document.body) {
    this._box.hide();
    return;
  }

  el = $(el);

  var offset = el.offset();
  var height = el.outerHeight();
  var width = el.outerWidth();
  this._box.css({
    zIndex: (parseInt(el.css("z-index")) || this._defaultZIndex) + 1 + " !important",
    left: offset.left,
    top: offset.top,
    height: height,
    width: width
  });
  this._target = el;
  this._tooltip.html(Overlay.elementToFilterString(el[0]));
  this._box.show();
  this._adjustTooltipOffset(offset);
}

// Calculates tooltip position using the offset of highlighted DOM element.
// Inputs: offset:object x y data
Overlay.prototype._adjustTooltipOffset = function(offset) {
  var wnd = $(window),
      y = wnd.scrollTop(),
      z = wnd.width(),
      w = wnd.height();

  var boxX = offset.left,
      boxY = offset.top,
      boxZ = this._box.width(),
      boxW = this._box.height();

  offset = this._tooltip.offset();
  var tipX = offset.left,
      tipY = offset.top,
      tipZ = this._tooltip.width(),
      tipW = this._tooltip.height();

  var posX = boxX,
      posY = y + 1;

  if (boxY - tipW - 1 > y)
    posY = boxY - tipW - 1;
  else if (boxY + boxW + tipW + 1 < y + w)
    posY = boxY + boxW + 1;

  if (boxX < 0)
    posX = 0;
  if (boxX + tipZ > z)
    posX = z - tipZ - 20;// TODO calculate real scrollbar width

  this._tooltip.offset({left:posX, top:posY});
}

// Registers mousemove listener
Overlay.prototype.enable = function() {
  if (!this._enabled && this._box) {
    this._element.delegate("*", "mousemove.nsMouseMoved",
      $.proxy(this._mousemove_handler, this));
    this._enabled = true;
  }
}

// Unregisters mousemove listener
Overlay.prototype.disable = function() {
  if (this._enabled && this._box) {
    this._box.hide();
    this._element.undelegate("*", "mousemove.nsMouseMoved");
    this._enabled = false;
  }
}

// Destroys overlay and its placeholder children. Calling this renders
// the overlay useless.
Overlay.prototype.remove = function() {
  this.disable();
  if (this._box) {
    this._box.remove();
    $.each(this._child_overlays, function(i, overlay) {
      overlay.remove();
    });
    this._child_overlays = [];
  }
}

Overlay.instances = [];
Overlay.prototype.display = Overlay.prototype.enable;
Overlay.removeAll = function() {
  $.each(Overlay.instances, function(i,overlay) {
    overlay.remove();
  });
  Overlay.instances = [];
}
