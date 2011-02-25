Overlay = function(options) {

  var el = $(options.dom_element);

  this.image = $("<div class='adblock-killme-overlay'></div>").
    css("position", "absolute").
    css("left", el.position().left).
    css("top", el.position().top).
    css("z-index", 1000000).
    width(el.width()).
    height(el.height());
  this.el = el;
  this.click_handler = options.click_handler;
  
  this.image.
    bind("mouseenter",function() {
      $(this).css("background-color", "rgba(130, 180, 230, 0.5) !important");
    }).
    bind("mouseleave",function() {
      $(this).css("background-color", "transparent !important");
    })

  Overlay.instances.push(this);
}
Overlay.instances = [];
Overlay.removeAll = function() {
  $.each(Overlay.instances, function(i,overlay) {
    overlay.image.remove();
  });
  Overlay.instances = [];
}
Overlay.prototype.display = function() {
  var that = this;
  this.image.
    appendTo(that.el.parent()).
    click(function() {
      that.click_handler(that.el);
      return false;
    });
}
