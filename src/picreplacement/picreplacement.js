var picreplacement = {

// data: {el, elType, blocked}
augmentIfAppropriate: function(data) {
  if (this._inHiddenSection(data.el)) {
    this._replaceHiddenSectionContaining(data.el);
  } else {
    var okTypes = (ElementTypes.image | ElementTypes.subdocument | ElementTypes["object"]);
    var replaceable = (data.el.nodeName !== "FRAME" && (data.elType & okTypes));
    if (data.blocked && replaceable) {
      this._replace(data.el);
    }
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
    if (!match) {
      return undefined;
    }
    return parseInt(match[1]);
  }
  // all of valid elements that we care about should have a tagName
  if (el.tagName === undefined) {
    return undefined;
  }
  if (typeof el.getAttribute === 'function') {
    return ( intFor(el.getAttribute(prop)) ||
             intFor(window.getComputedStyle(el)[prop]) );
  } else {
    return intFor(window.getComputedStyle(el)[prop]);
  }
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
  else if (Math.max(t.x,t.y) / Math.min(t.x,t.y) >= 1.5) // false unless (t.x && t.y)
    t.type = (t.x > t.y ? "wide" : "tall");

  if (!t.type) // we didn't choose wide/tall
    t.type = ((t.x || t.y) > 125 ? "big" : "small");
  return t;
},

// Returns placement details to replace |el|, or null
// if we do not have enough info to replace |el|.
_placementFor: function(el) {
  var picthemes = [ "snowden", "aiweiwei", "priot", "nkorea", "cuba", "adblock" ];
  var t = this._targetSize(el);
  var selectedThemeIndex = Math.floor(Math.random() * picthemes.length);
  var selectedTheme = picthemes[selectedThemeIndex];
  if (document.getElementsByClassName("picreplacement-" + selectedTheme).length > 0) {
    // if the color is found, just use the next one
    selectedThemeIndex++;
    if (selectedThemeIndex >= picthemes.length) {
      selectedThemeIndex = 0;
    }
    selectedTheme = picthemes[selectedThemeIndex];
  }
  var pics = this._picdata[t.type][selectedTheme];
  var pic = null;
  // loop through available pics to find a best match,
  // otherwise we'll use a random one
  if (t.x) {
    var candidatePic = null;
    var minDiff = -1;
    for (var i = 0; i < pics.length; i++) {
      var cp = pics[i];
      var diff = (t.x - cp.x);
      // don't select an image that bigger than the original
      if (diff < 0) {
        continue;
      }
      // select an exact match
      else if (diff === 0) {
        candidatePic = cp;
        minDiff = 0;
        break;
      }
      else if (minDiff === -1 || diff < minDiff) {
        candidatePic = cp;
        minDiff = diff;
      }
    }
    if (minDiff !== -1 && candidatePic !== null) {
        pic = candidatePic;
    }

    // now see if we can best fit on y
    if (t.y && pic !== null) {
        var minDiff = -1;
        for (var i = 0; i < pics.length; i++) {
            var cp = pics[i];
            var diff = (t.y - cp.y);
            if(diff < 0) {
              continue;
            } else if (pic.x === cp.x && diff === 0) {
              minDiff = 0;
              candidatePic = cp;
              break;
            } else if (pic.x === cp.x && (minDiff === -1 || diff < minDiff)) {
              candidatePic = cp;
              minDiff = diff;
            }
        }

        // We didn't find an image where the height is smaller than the placement container.
        // For now return null because we want to make sure the candidate image will
        // fit in the container.
        if (minDiff === -1) {
            return null;
        }

        // if different then set new candidate
        if (candidatePic !== pic) {
            pic = candidatePic;
        }
    } else {
        // If t.y isn't known don't use the only image that matches the height, or things
        // could get crowded.  Make sure that the width is > 250 so that an image of
        // big or wide size is used.
        if (t.x < 250) {
            return null;
        }
    }
  } else {
    // no width,just return;
    return null;
  }

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
  if (!t.x || !t.y || t.x < 40 || t.y < 40) {
    return null; // zero or unknown dims or too small to bother
  }

  var result = this._fit(pic, t);
  result.url = "https://cdn.adblockcdn.com/img/" + pic.filename + selectedTheme + "_" + this._determineLanguage() + ".png";
  result.info_url = "http://getadblock.com/amnesty_url/?l=" + this._determineLanguage() + "&v=" + selectedTheme + "&s=" + pic.x + "x" + pic.y;
  result.text = pic.text;
  result.color = selectedTheme;
  result.type = t.type;
  return result;
},

// Given a target element, replace it with a picture.
// Returns the replacement element if replacement works, or null if the target
// element could not be replaced.
_replace: function(el) {
  var placement = this._placementFor(el);
  if (!placement) {
    return null; // don't know how to replace |el|
  }
  if (document.getElementsByClassName("picreplacement-image").length > 1) {
    return null; //we only want to show 2 ad per page
  }
  var newPic = document.createElement("img");
  newPic.classList.add("picreplacement-image");
  newPic.classList.add("picreplacement-" + placement.color);

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

_determineLanguage: function() {
    var lang = determineUserLanguage();
    if (lang === "en" ||
        lang === "fr" ||
        lang === "es" ||
        lang === "ru") {
        return lang;
    }
    return "en";
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
        width: placement.width,
        height: Math.max(placement.height, 100)
      };
      function position_card(card) {
        var pos = $(newPic).offset();
        pos.top += (placement.height - cardsize.height) / 2;
        pos.left += (placement.width - cardsize.width) / 2;
        if (pos.top < 0) {
           pos.top = 0;
        }
        if (pos.left < 0) {
           pos.left = 0;
        }
        card.css(pos);
      };

      // CARD DIV
      newPic.infoCard = $("<div>", {
        "class": "picreplacement-infocard",
        css: {
          "position": "absolute",
          "width": cardsize.width,
          "min-height": cardsize.height,
          "z-index": 1000000,
          "padding": 0,
          "box-sizing": "border-box",
          "border": "2px solid yellow",
          "font": "normal small Arial, sans-serif",
          "background-color": "rgba(0, 0, 0, 0.9)"
        } });
      newPic.infoCard.appendTo("body");

      // ICON IMAGE
      newPic.infoCard
        .append($("<img>", {
          css: {
            position: "absolute",
            top: 0,
            left: 0,
            // independent.co.uk borders all imgs
            border: "none",
          },
          src: chrome.extension.getURL("img/icon24.png")
        }));

      newPic.infoCard
        .append($("<img>", {
          css: {
            position: "absolute",
            top: 0,
            right: 0,
            width: 20,
            height: 20,
            // independent.co.uk borders all imgs
            border: "none",
          },
          src: chrome.extension.getURL("img/close_icon.png"),
          click: function(e) {
            newPic.infoCard.remove();
            newPic.remove();
          }
        }))

      // BANNER WRAPPER
      var wrapper = $("<div>", {
        css: {
          "margin": "0 auto",
          "text-align": "center",
          "width": "100%",
          "height": "100%"
        }
      });

      // CONTENT CONTAINER
      var content_container = $("<div>", {
        css: {
          "margin": "0 auto",
          "text-align": "center",
          "width": "100%",
          "display": "table"
        }
      });

      // CONTENT WRAPPER
      var content_wrapper = $("<div>", {
        css: {
            "display": "table-cell",
            "vertical-align": "middle"
        }
      });

      var translate = picreplacement.translate;

      // BANNER TITLE (TODAY IS NATIONAL ETC)
      var header = $("<div>", {
          css: {
            "display": "table",
            "background-color": "yellow",
            "margin": "auto",
            "min-height": "20px",
            "width": "100%",
          },
          html: $("<div>", {
            text: translate("AI_title"),
            css: {
              "display": "table-cell",
              "vertical-align": "middle",
              "color": "black",
              "font-weight": "bold",
              "padding": "0 24px",
            }
          })
        })
      wrapper.append(header);

      content_wrapper.
        // CONTENT PITCH (WHO'S ARTICLE)
        append($("<div>", {
          css: {
              "margin": "0 5%",
          },
          html: $("<div>", {
              css: {
                  "text-align": "center",
                  "color": "white",
                  "font-weight": "bold",
              },
              text: translate(placement.text) + " "
          })
        }));

        if (placement.type !== "wide") {
            // READ ON AMNESTY
            content_wrapper.
            append($("<div>", {
                css: {
                },
                html: $("<button>", {
                    css: {
                      "padding": "5px",
                      "margin": "12px 5px",
                      "background": "yellow",
                      "border": "0",
                    },
                    html: $("<a>", {
                      href: placement.info_url,
                      target: "_blank",
                      text: translate("AI_learn_more"),
                      css: {
                          "text-decoration": "none",
                          "text-transform": "uppercase",
                          "font-weight": "bold",
                          "letter-spacing": "-0.5px",
                          "color": "black"
                      }
                    })
                })
            }));

          // STOP SHOWING BUTTON
          $("<div>", {
            css: {
            },
            html: $("<div>", {
                text: translate("AI_stop_showing"),
                css: {
                    "opacity": ".8",
                    "color": "white",
                    "font-size": "10px",
                    "cursor": "pointer",
                    "text-decoration": "underline",
                    "margin-bottom": "35px"
                }
              }).
                click(function() {
                  BGcall("set_setting", "do_picreplacement", false, function() {
                    $(".picreplacement-image, .picreplacement-infocard").remove();
                    alert(translate("AI_ok_no_more"));
                  });
                }),
          }).
            appendTo(content_wrapper);

        } else {
            var middle_div = $("<div>", {
                css: {
                    "width": "100%",
                },
            });

            // READ ON AMNESTY
            var read_on_amnesty = $("<div>", {
                css: {
                    "width": "50%",
                    "float": "left",
                },
                html: $("<button>", {
                    css: {
                        "background": "yellow",
                        "padding": "5px",
                        "border": "0",
                    },
                    html: $("<a>", {
                        href: placement.info_url,
                        target: "_blank",
                        text: translate("AI_learn_more"),
                        css: {
                            "text-decoration": "none",
                            "text-transform": "uppercase",
                            "font-weight": "bold",
                            "letter-spacing": "-0.5px",
                            "color": "black"
                        }
                    })
                })
              });

              // STOP SHOWING BUTTON
            var stop_div = $("<div>", {
                  css: {
                      "width": "50%",
                      "float": "left",
                      "display": "table",
                  },
                  html: $("<div>", {
                      text: translate("AI_stop_showing"),
                      css: {
                          "opacity": ".8",
                          "color": "white",
                          "font-size": "10px",
                          "cursor": "pointer",
                          "text-decoration": "underline",
                          "display": "table-cell",
                          "vertical-align": "middle",
                      }
                  }).
                  click(function() {
                      BGcall("set_setting", "do_picreplacement", false, function() {
                          $(".picreplacement-image, .picreplacement-infocard").remove();
                          alert(translate("AI_ok_no_more"));
                      });
                  })
              });

            middle_div.append(stop_div);
            middle_div.append(read_on_amnesty);
            content_wrapper.append($("<div>", {
                html: "&nbsp;",
                css: {
                    "top-margin": "5px",
                },
            }));
            middle_div.appendTo(content_wrapper);
            content_wrapper.append($("<div>", { html: "&nbsp;", css: { "margin-bottom": "15px" }}));
        }

       content_wrapper.appendTo(content_container);
       content_container.appendTo(wrapper);

      $("<br>").appendTo(wrapper);

      // WHY ARE WE DOING THIS??!?!
      var footer = $("<div>", {
          css: {
              "min-height": "30px",
              "background": "black",
              "position": "absolute",
              "width": "100%",
              "bottom":"0",
              "display": "table",
          },
          html: $("<a>", {
              css: {
                "color": "yellow",
                "font-weight": 550,
                "font-size": "12px",
                "vertical-align": "middle",
                "display": "table-cell",
              },
              href: "http://getadblock.com/amnesty2016",
              target: "_blank",
              text: translate("AI_why")
          })
      });
      footer.appendTo(wrapper);
      wrapper.appendTo(newPic.infoCard);
      //wrapper.css("margin-top", (newPic.infoCard.height() - wrapper.height()) / 2);

      // Now that all the elements are on the card so it knows its height...
      position_card(newPic.infoCard);

      if (stop_div) {
        stop_div.css({
            "height": read_on_amnesty.height(),
        });
      }

      newPic.infoCard.css({
          "height": content_container.height() + header.height() + footer.height(),
      });
      content_container.css({
          "height": newPic.infoCard.height() - header.height(),
      });

      wrapper.css({
          "height": newPic.infoCard.height() - header.height(),
      });
      content_container.css({
          "height": newPic.infoCard.height() - header.height(),
      });

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
  return chrome.i18n.getMessage(key);
},

_picdata: {
  "big": {
    "snowden": [
      { filename: "b_336_28_",
        text: "AI_snowden",
        x: 336, y: 280, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_3___25_",
        text: "AI_snowden",
        x: 300, y: 250, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_25__25_",
        text: "AI_snowden",
        x: 250, y: 250, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "aiweiwei": [
      { filename: "b_336_28_",
        text: "AI_aiweiwei",
        x: 336, y: 280, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_3___25_",
        text: "AI_aiweiwei",
        x: 300, y: 250, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_25__25_",
        text: "AI_aiweiwei",
        x: 250, y: 250, left: 0, right: 0, top: 0, bot: 0 },
   ],
    "priot": [
      { filename: "b_336_28_",
        text: "AI_pussyriot",
        x: 336, y: 280, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_3___25_",
        text: "AI_pussyriot",
        x: 300, y: 250, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_25__25_",
        text: "AI_pussyriot",
        x: 250, y: 250, left: 0, right: 0, top: 0, bot: 0 },
     ],
    "nkorea": [
      { filename: "b_336_28_",
        text: "AI_northkorea",
        x: 336, y: 280, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_3___25_",
        text: "AI_northkorea",
        x: 300, y: 250, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_25__25_",
        text: "AI_northkorea",
        x: 250, y: 250, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "cuba": [
      { filename: "b_336_28_",
        text: "AI_cuba",
        x: 336, y: 280, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_3___25_",
        text: "AI_cuba",
        x: 300, y: 250, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_25__25_",
        text: "AI_cuba",
        x: 250, y: 250, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "adblock": [
      { filename: "b_336_28_",
        text: "AI_adblock",
        x: 336, y: 280, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_3___25_",
        text: "AI_adblock",
        x: 300, y: 250, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_25__25_",
        text: "AI_adblock",
        x: 250, y: 250, left: 0, right: 0, top: 0, bot: 0 },
    ]
  },
  "small": {
    "snowden": [
    ],
    "aiweiwei": [
   ],
    "priot": [
     ],
    "nkorea": [
     ],
    "cuba": [
     ],
    "adblock": [
     ]
  },
  "wide": {
    "snowden": [
      { filename: "b_728_9_",
        text: "AI_snowden",
        x: 728, y: 90, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_468_6_",
        text: "AI_snowden",
        x: 468, y: 60, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "aiweiwei": [
      { filename: "b_728_9_",
        text: "AI_aiweiwei",
        x: 728, y: 90, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_468_6_",
        text: "AI_aiweiwei",
        x: 468, y: 60, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "priot": [
      { filename: "b_728_9_",
        text: "AI_pussyriot",
        x: 728, y: 90, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_468_6_",
        text: "AI_pussyriot",
        x: 468, y: 60, left: 0, right: 0, top: 0, bot: 0 },
     ],
    "nkorea": [
      { filename: "b_728_9_",
        text: "AI_northkorea",
        x: 728, y: 90, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_468_6_",
        text: "AI_northkorea",
        x: 468, y: 60, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "cuba": [
      { filename: "b_728_9_",
        text: "AI_cuba",
        x: 728, y: 90, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_468_6_",
        text: "AI_cuba",
        x: 468, y: 60, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "adblock": [
      { filename: "b_728_9_",
        text: "AI_adblock",
        x: 728, y: 90, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_468_6_",
        text: "AI_adblock",
        x: 468, y: 60, left: 0, right: 0, top: 0, bot: 0 },
    ]
  },
  "tall": {
    "snowden": [
      { filename: "b_16__6__",
        text: "AI_snowden",
        x: 160, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_12__6__",
        text: "AI_snowden",
        x: 120, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_24__4__",
        text: "AI_snowden",
        x: 240, y: 400, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "aiweiwei": [
      { filename: "b_16__6__",
        text: "AI_aiweiwei",
        x: 160, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_12__6__",
        text: "AI_aiweiwei",
        x: 120, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_24__4__",
        text: "AI_aiweiwei",
        x: 240, y: 400, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "priot": [
      { filename: "b_16__6__",
        text: "AI_pussyriot",
        x: 160, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_12__6__",
        text: "AI_pussyriot",
        x: 120, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_24__4__",
        text: "AI_pussyriot",
        x: 240, y: 400, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "nkorea": [
      { filename: "b_16__6__",
        text: "AI_northkorea",
        x: 160, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_12__6__",
        text: "AI_northkorea",
        x: 120, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_24__4__",
        text: "AI_northkorea",
        x: 240, y: 400, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "cuba": [
      { filename: "b_16__6__",
        text: "AI_cuba",
        x: 160, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_12__6__",
        text: "AI_cuba",
        x: 120, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_24__4__",
        text: "AI_cuba",
        x: 240, y: 400, left: 0, right: 0, top: 0, bot: 0 },
    ],
    "adblock": [
      { filename: "b_16__6__",
        text: "AI_adblock",
        x: 160, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_12__6__",
        text: "AI_adblock",
        x: 120, y: 600, left: 0, right: 0, top: 0, bot: 0 },
      { filename: "b_24__4__",
        text: "AI_adblock",
        x: 240, y: 400, left: 0, right: 0, top: 0, bot: 0 },
    ]
  }
}

}; // end picreplacement
