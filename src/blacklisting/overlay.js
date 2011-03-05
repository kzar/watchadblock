//Overlay = function(options) {
//
//  var el = $(options.dom_element);
//
//  this.image = $("<div class='adblock-killme-overlay'></div>").
//    css({
//      "position": "absolute",
//      "left": el.position().left,
//      "top": el.position().top,
//      "z-index": 1000000,
//      "background-color": "transparent !important"
//    }).
//    width(el.width()).
//    height(el.height());
//  this.el = el;
//  this.click_handler = options.click_handler;
//  
//  this.image.
//    bind("mouseenter",function() {
//      $(this).css("background-color", "rgba(130, 180, 230, 0.5) !important");
//    }).
//    bind("mouseleave",function() {
//      $(this).css("background-color", "transparent !important");
//    })
//
//  Overlay.instances.push(this);
//}
//Overlay.instances = [];
//Overlay.removeAll = function() {
//  $.each(Overlay.instances, function(i,overlay) {
//    overlay.image.remove();
//  });
//  Overlay.instances = [];
//}
//Overlay.prototype.display = function() {
//  var that = this;
//  this.image.
//    appendTo(that.el.parent()).
//    click(function() {
//      that.click_handler(that.el);
//      return false;
//    });
//}

// Highlight DOM elements with an overlayed box, similar to Webkit's inspector.
// Creates an absolute-positioned div that is translated & scaled following
// mousemove events. Holds a pointer to target DOM element.
// fix: set higher default z-index
// fix: use event delegation
Overlay = function(options) {
  this._enabled = false;
  this._target = null;
  this._delay = 25;
  this._then = +new Date();
  this._defaultZIndex = 10000;
  this._element = $(options.dom_element);
  this._click_handler = options.click_handler;
  this._tooltip = null;
  this._box = null;
  this._init();
  Overlay.instances.push(this);
}

Overlay.instances = [];
Overlay.elementToFilterString = function(el) {
  var str = el.nodeName.toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (el.className ? "." + $.trim(el.className).split(" ").join(".") : "");
  return str;
}

Overlay.prototype._init = function() {
  function onclick(e) {
    var el = e.target;
    el = this._enabled && (el === this._box[0] || el === this._tooltip[0]) ? this._target : el;
    this._click_handler(el);
  }
  
  this._tooltip = $("<div class='adblock-highlight-tooltip'></div>").
    css({
      font: "normal normal normal 12px/normal Courier, Verdana, Arial !important",
      backgroundColor: "#FFFFAA !important",
      outline: "solid 1px #000 !important",
      boxSizing: "border-box !important",
      position: "absolute !important",
      whiteSpace: "nowrap !important",
      lineHeight: "18px !important",
      padding: "0px 3px !important",
      cursor: "inherit !important",
      color: "#000 !important"
    });
    
  this._box = $("<div class='adblock-highlight-node'></div>").
    append(this._tooltip).
    css({
      backgroundColor: "rgba(130, 180, 230, 0.5) !important",
      outline: "solid 1px #0F4D9A !important",
      boxSizing: "border-box !important",
      position: "absolute !important", 
      cursor: "default !important",
      display: "none"
    }).
    click($.proxy(onclick, this)).
    appendTo(this._element);
}

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
  el = $(el);
  
  var offset = el.offset();
  var height = el.outerHeight();
  var width = el.outerWidth();
  this._box.css({
    zIndex: (parseInt(el.css("z-index")) || this._defaultZIndex) + " !important",
    height: height, 
    width: width, 
    left: offset.left, 
    top: offset.top 
  });
  this._target = el;
  this._tooltip.text(Overlay.elementToFilterString(el[0]) + " [" + width + "x" + height + "]");
  this._box.show();
  this._adjustTooltipOffset(offset);
}

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
      posY = boxY - tipW;
  
  // box top if there's space
  if (boxY - tipW - 1 > y)
    posY = boxY - tipW - 1;
  // or bottom if not
  else if (boxY + boxW + tipW + 1 < y + w)
    posY = boxY + boxW + 1;
  // else the window top
  else
    posY = y + 1;
  
  if (boxX < 0)
    posX = 0;
  if (boxX + tipZ > z)
    posX = z - tipZ - 20;// 20 for scrollbar width
  
  this._tooltip.offset({left:posX, top:posY});
}

Overlay.prototype.enable = function() {
  if (!this._enabled && this._box) {
    this._element.delegate("*", "mousemove.nsMouseMoved",
      $.proxy(this._mousemove_handler, this));
    this._enabled = true;
  }
}

Overlay.prototype.disable = function() {
  if (this._enabled && this._box) {
    this._box.hide();
    this._element.undelegate("*", "mousemove.nsMouseMoved");
    this._enabled = false;
  }
}

Overlay.prototype.remove = function() {
  this.disable();
  if (this._box) {
    this._box.remove();
    delete this._box;
  }
}

// monkey patched
Overlay.prototype.display = Overlay.prototype.enable;
Overlay.removeAll = function() {
  $.each(Overlay.instances, function(i,overlay) {
    overlay.remove();
  });
  Overlay.instances = [];
}
