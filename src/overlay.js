Overlay = function(options) {

  var el = $(options.dom_element);

  this.image = $("<div></div>").
    css("position", "absolute").
    css("left", el.position().left).
    css("top", el.position().top).
    css("z-index", 100000).
    width(el.width()).
    height(el.height());
  this.el = el;
  this.click_handler = options.click_handler;

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
