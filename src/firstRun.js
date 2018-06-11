/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/* globals checkShareResource, getDocLink, openSharePopup, setLinks, E */

"use strict";

(function()
{
  function onDOMLoaded()
  {
    // Set up logo image
    const logo = E("logo");
    logo.src = "skin/abp-128.png";
    const errorCallback = function()
    {
      logo.removeEventListener("error", errorCallback, false);
      // We are probably in Chrome/Opera/Safari, the image has a different path.
      logo.src = "icons/detailed/abp-128.png";
    };
    logo.addEventListener("error", errorCallback, false);

    // Set up URLs
    getDocLink("donate", (link) =>
    {
      E("donate").href = link;
    });

    getDocLink("contributors", (link) =>
    {
      E("contributors").href = link;
    });

    getDocLink("acceptable_ads_criteria", (link) =>
    {
      setLinks("acceptable-ads-explanation", link, openFilters);
    });

    getDocLink("contribute", (link) =>
    {
      setLinks("share-headline", link);
    });

    browser.runtime.sendMessage({
      type: "app.get",
      what: "issues"
    }, (issues) =>
    {
      // Show warning if we detected some data corruption
      if (issues.dataCorrupted)
      {
        E("datacorrupted-warning").removeAttribute("hidden");
        getDocLink("adblock_plus", (link) =>
        {
          setLinks("datacorrupted-reinstall", link);
        });
        getDocLink("help_center", (link) =>
        {
          setLinks("datacorrupted-support", link);
        });
      }
      // Show warning if filterlists settings were reinitialized
      else if (issues.filterlistsReinitialized)
      {
        E("filterlistsReinitializedWarning").removeAttribute("hidden");
        setLinks("filterlistsReinitializedWarning", openFilters);
      }
    });

    updateSocialLinks();

    const port = browser.runtime.connect({name: "ui"});

    port.onMessage.addListener((message) =>
    {
      if (message.type == "subscriptions.respond")
      {
        updateSocialLinks();
      }
    });

    port.postMessage({
      type: "subscriptions.listen",
      filter: ["added", "removed", "updated", "disabled"]
    });
  }

  function updateSocialLinks()
  {
    for (const network of ["twitter", "facebook", "gplus"])
    {
      const link = E("share-" + network);
      checkShareResource(link.getAttribute("data-script"), (isBlocked) =>
      {
        // Don't open the share page if the sharing script would be blocked
        if (isBlocked)
          link.removeEventListener("click", onSocialLinkClick, false);
        else
          link.addEventListener("click", onSocialLinkClick, false);
      });
    }
  }

  function onSocialLinkClick(event)
  {
    if (window.matchMedia("(max-width: 970px)").matches)
      return;

    event.preventDefault();

    getDocLink(event.target.id, (link) =>
    {
      openSharePopup(link);
    });
  }

  function openFilters()
  {
    browser.runtime.sendMessage({type: "app.open", what: "options"});
  }

  document.addEventListener("DOMContentLoaded", onDOMLoaded, false);
}());
