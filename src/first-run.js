/* eslint-disable */(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

"use strict";

function send(type, args)
{
  args = Object.assign({}, {type}, args);
  return browser.runtime.sendMessage(args);
}

const app = {
  get: (what) => send("app.get", {what}),
  open: (what) => send("app.open", {what})
};
module.exports.app = app;

const doclinks = {
  get: (link) => send("app.get", {what: "doclink", link})
};
module.exports.doclinks = doclinks;

},{}],2:[function(require,module,exports){
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

"use strict";

const api = require("./api");

function convertDocLinks()
{
  const elements = document.querySelectorAll("[data-doclink]");
  for (const element of elements)
  {
    const {doclink} = element.dataset;
    api.doclinks.get(doclink).then((url) =>
    {
      element.href = url;
    });
  }
}

function openOptions()
{
  api.app.open("options");
}

function initLinks()
{
  Promise.all([
    api.doclinks.get("acceptable_ads_criteria"),
    api.doclinks.get("acceptable_ads_opt_out")
  ]).then(([urlCriteria, urlOptOut]) =>
  {
    ext.i18n.setElementLinks(
      "control-description",
      urlCriteria, urlOptOut, openOptions
    );
  });

  api.doclinks.get("terms").then((url) =>
  {
    ext.i18n.setElementLinks("fair-description", url);
  });
  api.doclinks.get("eyeo").then((url) =>
  {
    const year = new Date().getFullYear();
    const notice = document.getElementById("copyright-notice");
    ext.i18n.setElementText(notice, "firstRun_footer_copyright", year);
    ext.i18n.setElementLinks("copyright-notice", url);
  });

  convertDocLinks();
}

function initWarnings()
{
  api.app.get("issues")
    .then((issues) =>
    {
      const warnings = [];

      // Show warning if we detected some data corruption
      if (issues.dataCorrupted)
      {
        warnings.push("dataCorrupted");
        api.doclinks.get("adblock_plus").then((url) =>
        {
          ext.i18n.setElementLinks("dataCorrupted-reinstall", url);
        });
        api.doclinks.get("help_center").then((url) =>
        {
          ext.i18n.setElementLinks(
            "dataCorrupted-support",
            "mailto:support@adblockplus.org",
            url
          );
        });
      }
      // Show warning if filterlists settings were reinitialized
      else if (issues.filterlistsReinitialized)
      {
        warnings.push("reinitialized");
        ext.i18n.setElementLinks("warning-reinitialized", openOptions);
      }

      // While our design isn't optimized for it yet, multiple warnings can
      // be shown by adding multiple strings the body's data-warnings attribute
      if (warnings.length)
      {
        document.body.dataset.warnings = warnings.join(" ");
      }
    });
}

function initApplication()
{
  api.app.get("application").then((application) =>
  {
    document.documentElement.dataset.application = application;
  });
}

// Translations are resolved on DOMContentLoaded so waiting for DOM by
// deferring script execution is insufficient
window.addEventListener("DOMContentLoaded", () =>
{
  initLinks();
  initWarnings();
  initApplication();
});

},{"./api":1}]},{},[2]);
