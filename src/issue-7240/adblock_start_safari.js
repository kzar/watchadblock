// If the background image is an ad, remove it.
function blockBackgroundImageAd() {
  var bgImage = getComputedStyle(document.body)["background-image"] || "";
  var match = bgImage.match(/^url\((.+)\)$/);
  if (!match)
    return;
  var hiddenImage = document.createElement("img");
    hiddenImage.src = match[1];
    hiddenImage.setAttribute("width", "0");
    hiddenImage.setAttribute("height", "0");
    hiddenImage.style.setProperty("display", "none");
    hiddenImage.style.setProperty("visibility", "hidden");
  document.body.appendChild(hiddenImage);
  window.setTimeout(function() {
    if (hiddenImage.style.opacity === "0") {
      document.body.style.setProperty("background-image", "none");
    }
    document.body.removeChild(hiddenImage);
  }, 1);
}

// Remove background images and purged elements.
// Return true if the element has been handled.
function weakDestroyElement(el, elType) {
  if (elType & ElementTypes.background) {
    el.style.setProperty("background-image", "none", "important");
    return true;
  }
  else if (elType == ElementTypes.script) {
    return true; // nothing to do
  }
  else {
    return false; // not handled by this function
  }
};

beforeLoadHandler = function(event) {
  var el = event.target;
  if (!el.nodeName) return; // issue 6256
  // Cancel the load if canLoad is false.
  var elType = typeForElement(el);
  var data = { 
    url: relativeToAbsoluteUrl(event.url),
    elType: elType,
    frameDomain: document.location.hostname
  };
  if (!safari.self.tab.canLoad(event, data)) {

    // Work around bugs.webkit.org/show_bug.cgi?id=65412
    // Allow the resource to load, but hide it afterwards.
    // Probably a normal site will never reach 250.
    beforeLoadHandler.blockCount++;
    if (beforeLoadHandler.blockCount > 250) {
      log("ABORTING: blocked over 250 requests, probably an infinite loading loop");
      beforeLoadHandler.blockCount = 0;
    } else
      event.preventDefault();

    if (!weakDestroyElement(el, elType))
      destroyElement(el, elType);
  }
}
beforeLoadHandler.blockCount = 0;

// Send the frame domain to the background when requested.
sendDomainHandler = function(event) {
  if (event.name === "send-domain") {
    var domain = document.location.hostname;
    safari.self.tab.dispatchMessage("send-domain-response", domain);
  }
}

adblock_begin({
  startPurger: function() { 
    document.addEventListener("beforeload", beforeLoadHandler, true);
    safari.self.addEventListener("message", sendDomainHandler, false);
  },
  stopPurger: function() { 
    document.removeEventListener("beforeload", beforeLoadHandler, true);
    safari.self.removeEventListener("message", sendDomainHandler, false);
  },
  handleHiding: function(data) {
    if (data.settings.new_safari_hiding && data.runnable && !data.hiding)
      document.documentElement.classList.add(data.avoidHidingClass);
    else if (!data.settings.new_safari_hiding && data.hiding)
      block_list_via_css(data.selectors);
  },
  success: function() {
    onReady(function() { blockBackgroundImageAd(); });

    // Add entries to right click menu of non-whitelisted pages.
    window.addEventListener("contextmenu", function(event) {
      safari.self.tab.setContextMenuEventUserInfo(event, true);
    }, false);
  }
});
