var picreplacement = {

// data: {el, elType, blocked}
augmentIfAppropriate: function(data) {
  if (this._inHiddenSection(data.el)) {
    this._replaceHiddenSectionContaining(data.el);
  }
  else {
    var okTypes = (ElementTypes.image | ElementTypes.subdocument | ElementTypes["object"]);
    var replaceable = (data.el.nodeName !== "FRAME" && (data.elType & okTypes));
    if (data.blocked && replaceable)
      this._replace(data.el);
  }
},

// Given details about a picture and a target rectangle, return details
// about how to place the picture in the target.
//
// pic object contains
//   x - width
//   y - height
//   left - max crop allowed from left
//   right - max crop allowed from right
//   top - max crop allowed from top
//   bot - max crop allowed from bottom
//
// target object contains
//   x - width
//   y - height
//
// result object contains
//   x - width of background image to use (before crop)
//   y - height of background image to use (before crop)
//   top  - amount to offset top of photo in target to cause a vertical crop
//   left - amount to offset left of photo in target to cause a horizontal crop
//   width - width of visible area of result image
//   height - height of visible area of result image
//   offsettop  - amount to pad with blank space above picture
//   offsetleft - amount to pad with blank space to left of picture
//                These are used to center a picture in a tall or wide target
_fit: function (pic, target) {
  var p=pic, t=target;
  // Step 0: if t.ratio > p.ratio, rotate |p| and |t| about their NW<->SE axes.

  // Our math in Step 1 and beyond relies on |t| being skinner than |p|.  We
  // rotate |t| and |p| about their NW<->SE axis if needed to make that true.
  var t_ratio = t.x / t.y;
  var p_ratio = p.x / p.y;
  if (t_ratio > p_ratio) {
    var rotate = this._rotate;
    rotate(pic); rotate(target);
    var result = this._fit(pic, target);
    rotate(pic); rotate(target);
    rotate(result);
    return result;
  }

  // |t| is skinnier than |p|, so we need to crop the picture horizontally.

  // Step 1: Calculate |crop_x|: total horizontal crop needed.
  var crop_max = Math.max(p.left + p.right, .001);
  // Crop as much as we must, but not past the max allowed crop.
  var crop_x = Math.min(p.x - p.y * t_ratio, crop_max);

  // Step 2: Calculate how much of that crop should be done on the left side
  // of the picture versus the right.

  // We will execute the crop by giving a background-image a CSS left offset,
  // so we only have to calculate the left crop and the right crop will happen
  // naturally due to the size of the target area not fitting the entire image.

  var crop_left = p.left * (crop_x / crop_max);

  // Step 3: Calculate how much we must scale up or down the original picture.
  
  var scale = t.x / (p.x - crop_x);

  // Scale the original picture and crop amounts in order to determine the width
  // and height of the visible display area, the x and y dimensions of the image
  // to display in it, and the crop amount to offset the image.  The end result
  // is an image positioned to show the correct pixels in the target area.

  var result = {};
  result.x = Math.round(p.x * scale);
  result.y = Math.round(p.y * scale);
  result.left = Math.round(crop_left * scale);
  result.width = Math.round(t.x);
  result.height = Math.round(result.y);

  // Step 4: Add vertical padding if we weren't allowed to crop as much as we
  // liked, resulting in an image not tall enough to fill the target.
  result.offsettop = Math.round((t.y - result.height) / 2);

  // Done!
  result.top = 0;
  result.offsetleft = 0;
  return result;
},

// Rotate a picture/target about its NW<->SE axis.
_rotate: function(o) {
  var pairs = [ ["x", "y"], ["top", "left"], ["bot", "right"], 
                ["offsettop", "offsetleft"], ["width", "height"] ];
  pairs.forEach(function(pair) {
    var a = pair[0], b = pair[1], tmp;
    if (o[a] || o[b]) {
      tmp = o[b]; o[b] = o[a]; o[a] = tmp; // swap
    }
  });
},

_dim: function(el, prop) {
  function intFor(val) {
    // Match two or more digits; treat < 10 as missing.  This lets us set
    // dims that look good for e.g. 1px tall ad holders (cnn.com footer.)
    var match = (val || "").match(/^([1-9][0-9]+)(px)?$/);
    if (!match) return undefined;
    return parseInt(match[1]);
  }
  return ( intFor(el.getAttribute(prop)) ||
           intFor(window.getComputedStyle(el)[prop]) );
},

_parentDim: function(el, prop) {
  // Special hack for Facebook, so Sponsored links are huge and beautiful
  // pictures instead of tiny or missing.
  if (/facebook/.test(document.location.href))
    return undefined;
  var result = undefined;
  while (!result && el.parentNode) {
    result = this._dim(el.parentNode, prop);
    el = el.parentNode;
  }
  return result;
},

_targetSize: function(el) {
  var t = { x: this._dim(el, "width"), y: this._dim(el, "height") };
  // Make it rectangular if ratio is appropriate, or if we only know one dim
  // and it's so big that the 180k pixel max will force the pic to be skinny.
  if (t.x && !t.y && t.x > 400)
    t.type = "wide";
  else if (t.y && !t.x && t.y > 400)
    t.type = "tall";
  else if (Math.max(t.x,t.y) / Math.min(t.x,t.y) >= 2) // false unless (t.x && t.y)
    t.type = (t.x > t.y ? "wide" : "tall");

  if (!t.type) // we didn't choose wide/tall
    t.type = ((t.x || t.y) > 125 ? "big" : "small");
  return t;
},

// Returns placement details to replace |el|, or null
// if we do not have enough info to replace |el|.
_placementFor: function(el) {
  var t = this._targetSize(el);
  var pics = this._picdata[t.type];
  var pic = pics[Math.floor(Math.random() * pics.length)];

  // If we only have one dimension, we may choose to use the picture's ratio;
  // but don't go over 180k pixels (so e.g. 1000x__ doesn't insert a 1000x1000
  // picture (cnn.com)).  And if an ancestor has a size, don't exceed that.
  if (t.x && !t.y) {
    var newY = Math.round(Math.min(pic.y * t.x / pic.x, 180000 / t.x));
    var parentY = this._parentDim(el, "height");
    t.y = (parentY ? Math.min(newY, parentY) : newY);
  }
  if (t.y && !t.x) {
    var newX = Math.round(Math.min(pic.x * t.y / pic.y, 180000 / t.y));
    var parentX = this._parentDim(el, "width");
    t.x = (parentX ? Math.min(newX, parentX) : newX);
  }
  if (!t.x || !t.y || t.x < 40 || t.y < 40)
    return null; // unknown dims or too small to bother

  var result = this._fit(pic, t);
  result.url = chrome.extension.getURL("picreplacement/img/" + pic.filename);
  return result;
},

// Given a target element, replace it with a picture.
// Returns the replacement element if replacement works, or null if the target
// element could not be replaced.
_replace: function(el) {
  var placement = this._placementFor(el);
  if (!placement)
    return null; // don't know how to replace |el|

  var newPic = document.createElement("img");
  newPic.classList.add("picreplacement-image");

  var css = {
    width: placement.width + "px",
    height: placement.height + "px",
    background: "url(" + placement.url + ") no-repeat",
    backgroundPosition: "-" + placement.left + "px -" + placement.top + "px",
    backgroundSize: placement.x + "px " + placement.y + "px",
    margin: placement.offsettop + "px " + placement.offsetleft + "px",
    // nytimes.com float:right ad at top is on the left without this
    "float": (window.getComputedStyle(el)["float"] || undefined)
  };
  for (var k in css) {
    newPic.style[k] = css[k];
  }
  // hotmail ad is position:absolute; we must match its placement.
  // battefield.play4free.net imgs are absolute; ad is not img. match it.
  // reddit homepage sometimes gets a whole screenful of white if
  // inserted <img> is inline instead of block like what it replaces.
  for (var k in {position:1,left:1,top:1,bottom:1,right:1,display:1}) {
    newPic.style[k] = window.getComputedStyle(el)[k];
  }

  // Prevent clicking through to ad
  newPic.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, false);


  this._addInfoCardTo(newPic, placement);

  // No need to hide the replaced element -- regular AdBlock will do that.
  el.dataset.picreplacementreplaced = "true";
  el.parentNode.insertBefore(newPic, el);

  return newPic;
},

// Add an info card to |newPic| that appears on hover.
_addInfoCardTo: function(newPic, placement) {
  if (newPic.infoCard)
    return;
  // We use a direct sendRequest onmouseenter to avoid modifying
  // emit_page_broadcast; we won't need this hovercard long though, after which
  // the code can all be deleted.  Create card the first time we mouseover.
  // Then we can use jQuery's mouseenter and mouseleave to control when the
  // card comes and goes.
  newPic.addEventListener("mouseover", function(e) {
    if (newPic.infoCard)
      return; // already created card
    function after_jquery_is_available() {
      var cardsize = { 
        width: Math.max(placement.width, 180), 
        height: Math.max(placement.height, 100) 
      };
      function position_card(card) {
        var pos = $(newPic).offset();
        pos.top += (placement.height - cardsize.height) / 2;
        pos.left += (placement.width - cardsize.width) / 2;
        if (pos.top < 0) pos.top = 0; if (pos.left < 0) pos.left = 0;
        card.css(pos);
      };

      newPic.infoCard = $("<div>", {
        "class": "picreplacement-infocard",
        css: { 
          "position": "absolute",
          "min-width": cardsize.width,
          "min-height": cardsize.height,
          "z-index": 1000000,
          "padding": 3,
          "box-sizing": "border-box",
          "border": "2px solid rgb(128, 128, 128)",
          "font": "normal small Arial, sans-serif",
          "color": "black",
          "background-color": "rgba(188, 188, 188, 0.7)",
        } });
      newPic.infoCard.appendTo("body");
      newPic.infoCard.
        append($("<img>", {
          css: {
            float: "right",
            // independent.co.uk borders all imgs
            border: "none",
          },
          src: chrome.extension.getURL("img/icon24.png") 
        })).
        append("<br>");

      var wrapper = $("<div>", {
        css: {
          "max-width": 180,
          "margin": "0 auto",
          "text-align": "center"
        }
      });
      var translate = picreplacement.translate;
      wrapper.
        append(translate("explanation") + " ").
        append($("<a>", { 
            href: translate("the_url"),
            target: "_blank",
            text: translate("learn_more")
          })).
        append("<br>").
        append("<br>");
      $("<input type='button' disabled>").
        val(translate("stop_showing")).
        css("opacity", ".4").
        click(function() {
          BGcall("set_setting", "do_picreplacement", false, function() {
            $(".picreplacement-image, .picreplacement-infocard").remove();
            alert(translate("ok_no_more"));
          });
        }).
        appendTo(wrapper);
      wrapper.appendTo(newPic.infoCard);
      wrapper.css("margin-top", (newPic.infoCard.height() - wrapper.height()) / 2);

      // Now that all the elements are on the card so it knows its height...
      position_card(newPic.infoCard);

      $(newPic).mouseover(function() {
        $(".picreplacement-infocard:visible").hide();
        // newPic may have moved relative to the document, so recalculate
        // position before showing.
        position_card(newPic.infoCard);
        newPic.infoCard.show();
      });
      // Known bug: mouseleave is not called if you mouse over only 1 pixel
      // of newPic, then leave.  So infoCard is not removed.
      newPic.infoCard.mouseleave(function() { 
        $(".picreplacement-infocard:visible").hide();
      });

      // The first time I show the card, the button is disabled.  Enable after
      // a moment so the user can read the card first.
      window.setTimeout(function() {
        newPic.infoCard.find("input").
          attr("disabled", null).
          animate({opacity: 1});
      }, 2000);
    }
    if (typeof jQuery !== "undefined") {
      after_jquery_is_available();
    }
    else {
      chrome.extension.sendRequest(
        { command:"picreplacement_inject_jquery", allFrames: (window !== window.top) }, 
        after_jquery_is_available
      );
    }
  }, false);
},

// Returns true if |el| or an ancestor was hidden by an AdBlock hiding rule.
_inHiddenSection: function(el) {
  return window.getComputedStyle(el).orphans === "4321";
},

// Find the ancestor of el that was hidden by AdBlock, and replace it
// with a picture.  Assumes _inHiddenSection(el) is true.
_replaceHiddenSectionContaining: function(el) {
  // Find the top hidden node (the one AdBlock originally hid)
  while (this._inHiddenSection(el.parentNode))
    el = el.parentNode;
  // We may have already replaced this section...
  if (el.dataset.picreplacementreplaced)
    return;

  var oldCssText = el.style.cssText;
  el.style.setProperty("visibility", "hidden", "important");
  el.style.setProperty("display", "block", "important");

  this._replace(el);

  el.style.cssText = oldCssText; // Re-hide the section
},

translate: function(key) {
  var text = {
    "explanation": {
      en: "AdBlock now shows you cats instead of ads!",
      es: "AdBlock ahora muestra los gatos en lugar de anuncios!",
      fr: "Dorénavant AdBlock affichera des chats à la place des publicités!",
      de: "AdBlock ersetzt ab heute Werbung durch Katzen!",
      ru: "AdBlock теперь отображается кошек вместо рекламы!",
      nl: "AdBlock toont je nu katten in plaats van advertenties!",
      zh: "现在显示的AdBlock猫，而不是广告！",
    },
    "stop_showing": {
      en: "Stop showing me cats!",
      es: "No mostrar los gatos!",
      fr: "Arrêter l'affichage des chats!",
      de: "Keine Katzen mehr anzeigen!",
      ru: "Не показывать кошек!",
      nl: "Toon geen katten meer!",
      zh: "不显示猫图片！",
    },
    "ok_no_more": {
      en: "OK, AdBlock will not show you any more cats.\n\nHappy April Fools' Day!",
      es: "OK, AdBlock no te mostrará los gatos.\n\nFeliz Día de los Inocentes!",
      fr: "OK, AdBlock n'affichera plus de chats.\n\nJ'espère que mon poisson d'avril vous a plu!",
      de: "AdBlock wird keine Katzen mehr anzeigen.\n\nApril, April!",
      ru: "Хорошо, AdBlock не будет отображаться кошек.\n\nЕсть счастливый День дурака",
      nl: "1 April!!\n\nAdBlock zal vanaf nu geen katten meer tonen.",
      zh: "OK，的AdBlock不会显示猫。\n\n幸福四月愚人节！",
    },
    "new": {
      en: "New!",
      es: "Nuevo!",
      fr: "Nouveau!",
      de: "Neu!",
      ru: "новое!",
      nl: "Nieuw!",
      zh: "新！",
    },
    "enable_picreplacement": {
      en: "Display a pretty picture in place of ads.",
      es: "Mostrar una foto bonita en lugar de anuncios.",
      fr: "Afficher des belles images à la place des publicités.",
      de: "Werbung durch schöne Bilder ersetzen.",
      ru: "Показать красивую картинку вместо объявления.",
      nl: "Toon een leuke afbeelding op de plaats waar advertenties stonden.",
      zh: "显示漂亮的照片，而不是广告。",
    },
    "learn_more": {
      en: "Learn more",
      es: "Más información",
      fr: "En savoir plus",
      de: "Mehr Informationen",
      ru: "Подробнее",
      nl: "Meer informatie",
      zh: "了解更多信息",
    },
    "the_url": {
      // don't translate into other locales
      en: "https://chromeadblock.com/catblock/"
    }
  };
  var locale = navigator.language.substring(0, 2);
  var msg = text[key] || {};
  return msg[locale] || msg["en"];
},

_picdata: { 
  "big": [
    { filename: "5.jpg", 
      x: 270, y: 256, left: 20, right: 5, top: 27, bot: 0 },
    { filename: "6.jpg", 
      x: 350, y: 263, left: 153, right: 54, top: 45, bot: 87 },
    { filename: "big1.jpg", 
      x: 228, y: 249, left: 96, right: 52, top: 68, bot: 67 },
    { filename: "big2.jpg", 
      x: 236, y: 399, left: 41, right: 0, top: 0, bot: 50 },
    { filename: "big3.jpg", 
      x: 340, y: 375, left: 0, right: 52, top: 42, bot: 10 },
    { filename: "big4.jpg", 
      x: 170, y: 240, left: 28, right: 87, top: 20, bot: 4 },
    { filename: "1.jpg", 
      x: 384, y: 288, left: 52, right: 121, top: 73, bot: 36 },
  ],
  "small": [
    { filename: "7.jpg", 
      x: 132, y: 91, left: 33, right: 26, top: 0, bot: 0 },
    { filename: "9.jpg", 
      x: 121, y: 102, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "small1.jpg", 
      x: 115, y: 125, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "small2.jpg", 
      x: 126, y: 131, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "small3.jpg", 
      x: 105, y: 98, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "small4.jpg", 
      x: 135, y: 126, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "small5.jpg", 
      x: 133, y: 108, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "small6.jpg", 
      x: 120, y: 99, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "small7.jpg", 
      x: 124, y: 96, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "small8.jpg", 
      x: 119, y: 114, left: 0, right: 0, top: 0, bot: 0 },
  ],
  "wide": [
    { filename: "wide1.jpg",
      x: 382, y: 137, left: 0, right: 0, top: 9, bot: 5 },
    { filename: "wide2.jpg", 
      x: 470, y: 102, left:0, right: 0, top: 0, bot: 0 },
    { filename: "wide3.jpg", 
      x: 251, y: 90, left:0, right: 0, top: 0, bot: 0 },
    { filename: "wide4.jpg", 
      x: 469, y: 162, left:0, right: 0, top: 22, bot: 12 },
    { filename: "big3.jpg",  // big
      x: 340, y: 375, left: 0, right: 0, top: 66, bot: 226 },
    { filename: "1.jpg",  // big
      x: 384, y: 288, left: 0, right: 0, top: 116, bot: 117 },
    { filename: "6.jpg",  // big
      x: 350, y: 263, left: 0, right: 0, top: 73, bot: 100 },
  ],
  "tall": [
    { filename: "8.jpg", 
      x: 240, y: 480, left: 69, right: 51, top: 0, bot: 0 },
    { filename: "tall3.jpg", 
      x: 103, y: 272, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "tall4.jpg", 
      x: 139, y: 401, left: 0, right: 0, top: 0, bot: 0 },
    { filename: "tall5.jpg",
      x: 129, y: 320, left: 5, right: 28, top: 0, bot: 0 },
    { filename: "tall6.jpg", 
      x: 109, y: 385, left: 9, right: 7, top: 0, bot: 0 },
    { filename: "5.jpg",  // big
      x: 270, y: 256, left: 180, right: 45, top: 0, bot: 0 },
    { filename: "big1.jpg",  // big
      x: 228, y: 249, left: 96, right: 52, top: 0, bot: 0 },
    { filename: "big3.jpg",  // big
      x: 340, y: 375, left: 159, right: 60, top: 0, bot: 0 },
  ],
}

}; // end picreplacement
