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

/* globals getDoclink */

"use strict";

(function()
{
  function onDOMLoaded()
  {
    const optionsPageLink = document.querySelector("#options-page-news > a");
    optionsPageLink.addEventListener("click", () =>
    {
      browser.runtime.sendMessage(
        {
          type: "app.open",
          what: "options"
        }
      );
    });
    getDoclink("adblock_browser_website").then(url =>
    {
      ext.i18n.setElementLinks("adblock-browser-text", url);
    });
  }
  document.addEventListener("DOMContentLoaded", onDOMLoaded, false);
}());
