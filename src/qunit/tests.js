/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 18);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * @fileOverview Definition of Filter class and its subclasses.
 */

const {filterNotifier} = __webpack_require__(2);
const {extend} = __webpack_require__(13);
const {filterToRegExp} = __webpack_require__(20);

/**
 * All known unique domain sources mapped to their parsed values.
 * @type {Map.<string,Map.<string,boolean>>}
 */
let knownDomainMaps = new Map();

/**
 * Abstract base class for filters
 *
 * @param {string} text   string representation of the filter
 * @constructor
 */
function Filter(text)
{
  this.text = text;

  /**
   * Subscriptions to which this filter belongs.
   * @type {(Subscription|Set.<Subscription>)?}
   * @private
   */
  this._subscriptions = null;
}
exports.Filter = Filter;

Filter.prototype =
{
  /**
   * String representation of the filter
   * @type {string}
   */
  text: null,

  /**
   * Filter type as a string, e.g. "blocking".
   * @type {string}
   */
  get type()
  {
    throw new Error("Please define filter type in the subclass");
  },

  /**
   * Yields subscriptions to which the filter belongs.
   * @yields {Subscription}
   */
  *subscriptions()
  {
    if (this._subscriptions)
    {
      if (this._subscriptions instanceof Set)
        yield* this._subscriptions;
      else
        yield this._subscriptions;
    }
  },

  /**
   * The number of subscriptions to which the filter belongs.
   * @type {number}
   */
  get subscriptionCount()
  {
    if (this._subscriptions instanceof Set)
      return this._subscriptions.size;

    return this._subscriptions ? 1 : 0;
  },

  /**
   * Adds a subscription to the set of subscriptions to which the filter
   * belongs.
   * @param {Subscription} subscription
   */
  addSubscription(subscription)
  {
    // Since we use truthy checks in our logic, we must avoid adding a
    // subscription that isn't a non-null object.
    if (subscription === null || typeof subscription != "object")
      return;

    if (this._subscriptions)
    {
      if (this._subscriptions instanceof Set)
        this._subscriptions.add(subscription);
      else if (subscription != this._subscriptions)
        this._subscriptions = new Set([this._subscriptions, subscription]);
    }
    else
    {
      this._subscriptions = subscription;
    }
  },

  /**
   * Removes a subscription from the set of subscriptions to which the filter
   * belongs.
   * @param {Subscription} subscription
   */
  removeSubscription(subscription)
  {
    if (this._subscriptions)
    {
      if (this._subscriptions instanceof Set)
      {
        this._subscriptions.delete(subscription);

        if (this._subscriptions.size == 1)
          this._subscriptions = [...this._subscriptions][0];
      }
      else if (subscription == this._subscriptions)
      {
        this._subscriptions = null;
      }
    }
  },

  /**
   * Serializes the filter to an array of strings for writing out on the disk.
   * @param {string[]} buffer  buffer to push the serialization results into
   */
  serialize(buffer)
  {
    buffer.push("[Filter]");
    buffer.push("text=" + this.text);
  },

  toString()
  {
    return this.text;
  }
};

/**
 * Cache for known filters, maps string representation to filter objects.
 * @type {Map.<string,Filter>}
 */
Filter.knownFilters = new Map();

/**
 * Regular expression that content filters should match
 * @type {RegExp}
 */
Filter.contentRegExp = /^([^/*|@"!]*?)#([@?$])?#(.+)$/;
/**
 * Regular expression that options on a RegExp filter should match
 * @type {RegExp}
 */
Filter.optionsRegExp = /\$(~?[\w-]+(?:=[^,]*)?(?:,~?[\w-]+(?:=[^,]*)?)*)$/;
/**
 * Regular expression that matches an invalid Content Security Policy
 * @type {RegExp}
 */
Filter.invalidCSPRegExp = /(;|^) ?(base-uri|referrer|report-to|report-uri|upgrade-insecure-requests)\b/i;

/**
 * Creates a filter of correct type from its text representation - does the
 * basic parsing and calls the right constructor then.
 *
 * @param {string} text   as in Filter()
 * @return {Filter}
 */
Filter.fromText = function(text)
{
  let filter = Filter.knownFilters.get(text);
  if (filter)
    return filter;

  if (text[0] == "!")
  {
    filter = new CommentFilter(text);
  }
  else
  {
    let match = text.includes("#") ? Filter.contentRegExp.exec(text) : null;
    if (match)
      filter = ContentFilter.fromText(text, match[1], match[2], match[3]);
    else
      filter = RegExpFilter.fromText(text);
  }

  Filter.knownFilters.set(filter.text, filter);
  return filter;
};

/**
 * Deserializes a filter
 *
 * @param {Object}  obj map of serialized properties and their values
 * @return {Filter} filter or null if the filter couldn't be created
 */
Filter.fromObject = function(obj)
{
  let filter = Filter.fromText(obj.text);
  if (filter instanceof ActiveFilter)
  {
    if ("disabled" in obj)
      filter._disabled = (obj.disabled == "true");
    if ("hitCount" in obj)
      filter._hitCount = parseInt(obj.hitCount, 10) || 0;
    if ("lastHit" in obj)
      filter._lastHit = parseInt(obj.lastHit, 10) || 0;
  }
  return filter;
};

/**
 * Removes unnecessary whitespaces from filter text, will only return null if
 * the input parameter is null.
 * @param {string} text
 * @return {string}
 */
Filter.normalize = function(text)
{
  if (!text)
    return text;

  // Remove line breaks, tabs etc
  text = text.replace(/[^\S ]+/g, "");

  // Don't remove spaces inside comments
  if (/^ *!/.test(text))
    return text.trim();

  // Special treatment for content filters, right side is allowed to contain
  // spaces
  if (Filter.contentRegExp.test(text))
  {
    let [, domains, separator, body] = /^(.*?)(#[@?$]?#?)(.*)$/.exec(text);
    return domains.replace(/ +/g, "") + separator + body.trim();
  }

  // For most regexp filters we strip all spaces, but $csp filter options
  // are allowed to contain single (non trailing) spaces.
  let strippedText = text.replace(/ +/g, "");
  if (!strippedText.includes("$") || !/\bcsp=/i.test(strippedText))
    return strippedText;

  let optionsMatch = Filter.optionsRegExp.exec(strippedText);
  if (!optionsMatch)
    return strippedText;

  // For $csp filters we must first separate out the options part of the
  // text, being careful to preserve its spaces.
  let beforeOptions = strippedText.substring(0, optionsMatch.index);
  let strippedDollarIndex = -1;
  let dollarIndex = -1;
  do
  {
    strippedDollarIndex = beforeOptions.indexOf("$", strippedDollarIndex + 1);
    dollarIndex = text.indexOf("$", dollarIndex + 1);
  }
  while (strippedDollarIndex != -1);
  let optionsText = text.substr(dollarIndex + 1);

  // Then we can normalize spaces in the options part safely
  let options = optionsText.split(",");
  for (let i = 0; i < options.length; i++)
  {
    let option = options[i];
    let cspMatch = /^ *c *s *p *=/i.exec(option);
    if (cspMatch)
    {
      options[i] = cspMatch[0].replace(/ +/g, "") +
                   option.substr(cspMatch[0].length).trim().replace(/ +/g, " ");
    }
    else
      options[i] = option.replace(/ +/g, "");
  }

  return beforeOptions + "$" + options.join();
};

/**
 * Class for invalid filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} reason Reason why this filter is invalid
 * @constructor
 * @augments Filter
 */
function InvalidFilter(text, reason)
{
  Filter.call(this, text);

  this.reason = reason;
}
exports.InvalidFilter = InvalidFilter;

InvalidFilter.prototype = extend(Filter, {
  type: "invalid",

  /**
   * Reason why this filter is invalid
   * @type {string}
   */
  reason: null,

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize(buffer) {}
});

/**
 * Class for comments
 * @param {string} text see {@link Filter Filter()}
 * @constructor
 * @augments Filter
 */
function CommentFilter(text)
{
  Filter.call(this, text);
}
exports.CommentFilter = CommentFilter;

CommentFilter.prototype = extend(Filter, {
  type: "comment",

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize(buffer) {}
});

/**
 * Abstract base class for filters that can get hits
 * @param {string} text
 *   see {@link Filter Filter()}
 * @param {string} [domains]
 *   Domains that the filter is restricted to separated by domainSeparator
 *   e.g. "foo.com|bar.com|~baz.com"
 * @constructor
 * @augments Filter
 */
function ActiveFilter(text, domains)
{
  Filter.call(this, text);

  if (domains)
    this.domainSource = domains;
}
exports.ActiveFilter = ActiveFilter;

ActiveFilter.prototype = extend(Filter, {
  _disabled: false,
  _hitCount: 0,
  _lastHit: 0,

  /**
   * Defines whether the filter is disabled
   * @type {boolean}
   */
  get disabled()
  {
    return this._disabled;
  },
  set disabled(value)
  {
    if (value != this._disabled)
    {
      let oldValue = this._disabled;
      this._disabled = value;
      filterNotifier.emit("filter.disabled", this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * Number of hits on the filter since the last reset
   * @type {number}
   */
  get hitCount()
  {
    return this._hitCount;
  },
  set hitCount(value)
  {
    if (value != this._hitCount)
    {
      let oldValue = this._hitCount;
      this._hitCount = value;
      filterNotifier.emit("filter.hitCount", this, value, oldValue);
    }
    return this._hitCount;
  },

  /**
   * Last time the filter had a hit (in milliseconds since the beginning of the
   * epoch)
   * @type {number}
   */
  get lastHit()
  {
    return this._lastHit;
  },
  set lastHit(value)
  {
    if (value != this._lastHit)
    {
      let oldValue = this._lastHit;
      this._lastHit = value;
      filterNotifier.emit("filter.lastHit", this, value, oldValue);
    }
    return this._lastHit;
  },

  /**
   * String that the domains property should be generated from
   * @type {?string}
   */
  domainSource: null,

  /**
   * Separator character used in domainSource property, must be
   * overridden by subclasses
   * @type {string}
   */
  domainSeparator: null,

  /**
   * Determines whether domainSource is already lower-case,
   * can be overridden by subclasses.
   * @type {boolean}
   */
  domainSourceIsLowerCase: false,

  /**
   * Map containing domains that this filter should match on/not match
   * on or null if the filter should match on all domains
   * @type {?Map.<string,boolean>}
   */
  get domains()
  {
    let domains = null;

    if (this.domainSource)
    {
      let source = this.domainSource;
      if (!this.domainSourceIsLowerCase)
      {
        // RegExpFilter already have lowercase domains
        source = source.toLowerCase();
      }

      let knownMap = knownDomainMaps.get(source);
      if (knownMap)
      {
        domains = knownMap;
      }
      else
      {
        let list = source.split(this.domainSeparator);
        if (list.length == 1 && list[0][0] != "~")
        {
          // Fast track for the common one-domain scenario
          domains = new Map([[list[0], true], ["", false]]);
        }
        else
        {
          let hasIncludes = false;
          for (let i = 0; i < list.length; i++)
          {
            let domain = list[i];
            if (domain == "")
              continue;

            let include;
            if (domain[0] == "~")
            {
              include = false;
              domain = domain.substr(1);
            }
            else
            {
              include = true;
              hasIncludes = true;
            }

            if (!domains)
              domains = new Map();

            domains.set(domain, include);
          }

          if (domains)
            domains.set("", !hasIncludes);
        }

        if (domains)
          knownDomainMaps.set(source, domains);
      }

      this.domainSource = null;
    }

    Object.defineProperty(this, "domains", {value: domains});
    return this.domains;
  },

  /**
   * Array containing public keys of websites that this filter should apply to
   * @type {?string[]}
   */
  sitekeys: null,

  /**
   * Checks whether this filter is active on a domain.
   * @param {string} [docDomain] domain name of the document that loads the URL
   * @param {string} [sitekey] public key provided by the document
   * @return {boolean} true in case of the filter being active
   */
  isActiveOnDomain(docDomain, sitekey)
  {
    // Sitekeys are case-sensitive so we shouldn't convert them to
    // upper-case to avoid false positives here. Instead we need to
    // change the way filter options are parsed.
    if (this.sitekeys &&
        (!sitekey || this.sitekeys.indexOf(sitekey.toUpperCase()) < 0))
    {
      return false;
    }

    let {domains} = this;

    // If no domains are set the rule matches everywhere
    if (!domains)
      return true;

    // If the document has no host name, match only if the filter
    // isn't restricted to specific domains
    if (!docDomain)
      return domains.get("");

    docDomain = docDomain.replace(/\.+$/, "").toLowerCase();

    while (true)
    {
      let isDomainIncluded = domains.get(docDomain);
      if (typeof isDomainIncluded != "undefined")
        return isDomainIncluded;

      let nextDot = docDomain.indexOf(".");
      if (nextDot < 0)
        break;
      docDomain = docDomain.substr(nextDot + 1);
    }
    return domains.get("");
  },

  /**
   * Checks whether this filter is active only on a domain and its subdomains.
   * @param {string} docDomain
   * @return {boolean}
   */
  isActiveOnlyOnDomain(docDomain)
  {
    let {domains} = this;

    if (!docDomain || !domains || domains.get(""))
      return false;

    docDomain = docDomain.replace(/\.+$/, "").toLowerCase();

    for (let [domain, isIncluded] of domains)
    {
      if (isIncluded && domain != docDomain)
      {
        if (domain.length <= docDomain.length)
          return false;

        if (!domain.endsWith("." + docDomain))
          return false;
      }
    }

    return true;
  },

  /**
   * Checks whether this filter is generic or specific
   * @return {boolean}
   */
  isGeneric()
  {
    let {sitekeys, domains} = this;

    return !(sitekeys && sitekeys.length) && (!domains || domains.get(""));
  },

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    if (this._disabled || this._hitCount || this._lastHit)
    {
      Filter.prototype.serialize.call(this, buffer);
      if (this._disabled)
        buffer.push("disabled=true");
      if (this._hitCount)
        buffer.push("hitCount=" + this._hitCount);
      if (this._lastHit)
        buffer.push("lastHit=" + this._lastHit);
    }
  }
});

/**
 * Abstract base class for RegExp-based filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} regexpSource
 *   filter part that the regular expression should be build from
 * @param {number} [contentType]
 *   Content types the filter applies to, combination of values from
 *   RegExpFilter.typeMap
 * @param {boolean} [matchCase]
 *   Defines whether the filter should distinguish between lower and upper case
 *   letters
 * @param {string} [domains]
 *   Domains that the filter is restricted to, e.g. "foo.com|bar.com|~baz.com"
 * @param {boolean} [thirdParty]
 *   Defines whether the filter should apply to third-party or first-party
 *   content only
 * @param {string} [sitekeys]
 *   Public keys of websites that this filter should apply to
 * @constructor
 * @augments ActiveFilter
 */
function RegExpFilter(text, regexpSource, contentType, matchCase, domains,
                      thirdParty, sitekeys)
{
  ActiveFilter.call(this, text, domains, sitekeys);

  if (contentType != null)
    this.contentType = contentType;
  if (matchCase)
    this.matchCase = matchCase;
  if (thirdParty != null)
    this.thirdParty = thirdParty;
  if (sitekeys != null)
    this.sitekeySource = sitekeys;

  if (regexpSource.length >= 2 &&
      regexpSource[0] == "/" &&
      regexpSource[regexpSource.length - 1] == "/")
  {
    // The filter is a regular expression - convert it immediately to
    // catch syntax errors
    let regexp = new RegExp(regexpSource.substr(1, regexpSource.length - 2),
                            this.matchCase ? "" : "i");
    Object.defineProperty(this, "regexp", {value: regexp});
  }
  else
  {
    // No need to convert this filter to regular expression yet, do it on demand
    this.pattern = regexpSource;
  }
}
exports.RegExpFilter = RegExpFilter;

RegExpFilter.prototype = extend(ActiveFilter, {
  /**
   * @see ActiveFilter.domainSourceIsLowerCase
   */
  domainSourceIsLowerCase: true,

  /**
   * Number of filters contained, will always be 1 (required to
   * optimize {@link Matcher}).
   * @type {number}
   */
  length: 1,

  /**
   * The filter itself (required to optimize {@link Matcher}).
   * @type {RegExpFilter}
   */
  get 0()
  {
    return this;
  },

  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: "|",

  /**
   * Expression from which a regular expression should be generated -
   * for delayed creation of the regexp property
   * @type {?string}
   */
  pattern: null,
  /**
   * Regular expression to be used when testing against this filter
   * @type {RegExp}
   */
  get regexp()
  {
    let source = filterToRegExp(this.pattern, this.rewrite != null);
    let regexp = new RegExp(source, this.matchCase ? "" : "i");
    Object.defineProperty(this, "regexp", {value: regexp});
    return regexp;
  },
  /**
   * Content types the filter applies to, combination of values from
   * RegExpFilter.typeMap
   * @type {number}
   */
  contentType: 0x7FFFFFFF,
  /**
   * Defines whether the filter should distinguish between lower and
   * upper case letters
   * @type {boolean}
   */
  matchCase: false,
  /**
   * Defines whether the filter should apply to third-party or
   * first-party content only. Can be null (apply to all content).
   * @type {?boolean}
   */
  thirdParty: null,

  /**
   * String that the sitekey property should be generated from
   * @type {?string}
   */
  sitekeySource: null,

  /**
   * @see ActiveFilter.sitekeys
   */
  get sitekeys()
  {
    let sitekeys = null;

    if (this.sitekeySource)
    {
      sitekeys = this.sitekeySource.split("|");
      this.sitekeySource = null;
    }

    Object.defineProperty(
      this, "sitekeys", {value: sitekeys, enumerable: true}
    );
    return this.sitekeys;
  },

  /**
   * Tests whether the URL matches this filter
   * @param {string} location URL to be tested
   * @param {number} typeMask bitmask of content / request types to match
   * @param {string} [docDomain] domain name of the document that loads the URL
   * @param {boolean} [thirdParty] should be true if the URL is a third-party
   *                               request
   * @param {string} [sitekey] public key provided by the document
   * @return {boolean} true in case of a match
   */
  matches(location, typeMask, docDomain, thirdParty, sitekey)
  {
    return (this.contentType & typeMask) != 0 &&
           (this.thirdParty == null || this.thirdParty == thirdParty) &&
           this.isActiveOnDomain(docDomain, sitekey) &&
           this.regexp.test(location);
  }
});

/**
 * Creates a RegExp filter from its text representation
 * @param {string} text   same as in Filter()
 * @return {Filter}
 */
RegExpFilter.fromText = function(text)
{
  let blocking = true;
  let origText = text;
  if (text[0] == "@" && text[1] == "@")
  {
    blocking = false;
    text = text.substr(2);
  }

  let contentType = null;
  let matchCase = null;
  let domains = null;
  let sitekeys = null;
  let thirdParty = null;
  let collapse = null;
  let csp = null;
  let rewrite = null;
  let options;
  let match = text.includes("$") ? Filter.optionsRegExp.exec(text) : null;
  if (match)
  {
    options = match[1].split(",");
    text = match.input.substr(0, match.index);
    for (let option of options)
    {
      let value = null;
      let separatorIndex = option.indexOf("=");
      if (separatorIndex >= 0)
      {
        value = option.substr(separatorIndex + 1);
        option = option.substr(0, separatorIndex);
      }

      let inverse = option[0] == "~";
      if (inverse)
        option = option.substr(1);

      let type = RegExpFilter.typeMap[option.replace(/-/, "_").toUpperCase()];
      if (type)
      {
        if (inverse)
        {
          if (contentType == null)
            ({contentType} = RegExpFilter.prototype);
          contentType &= ~type;
        }
        else
        {
          contentType |= type;

          if (type == RegExpFilter.typeMap.CSP)
          {
            if (blocking && !value)
              return new InvalidFilter(origText, "filter_invalid_csp");
            csp = value;
          }
        }
      }
      else
      {
        switch (option.toLowerCase())
        {
          case "match-case":
            matchCase = !inverse;
            break;
          case "domain":
            if (!value)
              return new InvalidFilter(origText, "filter_unknown_option");
            domains = value.toLowerCase();
            break;
          case "third-party":
            thirdParty = !inverse;
            break;
          case "collapse":
            collapse = !inverse;
            break;
          case "sitekey":
            if (!value)
              return new InvalidFilter(origText, "filter_unknown_option");
            sitekeys = value.toUpperCase();
            break;
          case "rewrite":
            if (value == null)
              return new InvalidFilter(origText, "filter_unknown_option");
            rewrite = value;
            break;
          default:
            return new InvalidFilter(origText, "filter_unknown_option");
        }
      }
    }
  }

  // For security reasons, never match $rewrite filters
  // against requests that might load any code to be executed.
  if (rewrite != null)
  {
    if (contentType == null)
      ({contentType} = RegExpFilter.prototype);
    contentType &= ~(RegExpFilter.typeMap.SCRIPT |
                     RegExpFilter.typeMap.SUBDOCUMENT |
                     RegExpFilter.typeMap.OBJECT |
                     RegExpFilter.typeMap.OBJECT_SUBREQUEST);
  }

  try
  {
    if (blocking)
    {
      if (csp && Filter.invalidCSPRegExp.test(csp))
        return new InvalidFilter(origText, "filter_invalid_csp");

      return new BlockingFilter(origText, text, contentType, matchCase, domains,
                                thirdParty, sitekeys, collapse, csp, rewrite);
    }
    return new WhitelistFilter(origText, text, contentType, matchCase, domains,
                               thirdParty, sitekeys);
  }
  catch (e)
  {
    return new InvalidFilter(origText, "filter_invalid_regexp");
  }
};

/**
 * Maps type strings like "SCRIPT" or "OBJECT" to bit masks
 */
RegExpFilter.typeMap = {
  OTHER: 1,
  SCRIPT: 2,
  IMAGE: 4,
  STYLESHEET: 8,
  OBJECT: 16,
  SUBDOCUMENT: 32,
  DOCUMENT: 64,
  WEBSOCKET: 128,
  WEBRTC: 256,
  CSP: 512,
  XBL: 1,
  PING: 1024,
  XMLHTTPREQUEST: 2048,
  OBJECT_SUBREQUEST: 4096,
  DTD: 1,
  MEDIA: 16384,
  FONT: 32768,

  BACKGROUND: 4,    // Backwards compat, same as IMAGE

  POPUP: 0x10000000,
  GENERICBLOCK: 0x20000000,
  ELEMHIDE: 0x40000000,
  GENERICHIDE: 0x80000000
};

// CSP, DOCUMENT, ELEMHIDE, POPUP, GENERICHIDE and GENERICBLOCK options
// shouldn't be there by default
RegExpFilter.prototype.contentType &= ~(RegExpFilter.typeMap.CSP |
                                        RegExpFilter.typeMap.DOCUMENT |
                                        RegExpFilter.typeMap.ELEMHIDE |
                                        RegExpFilter.typeMap.POPUP |
                                        RegExpFilter.typeMap.GENERICHIDE |
                                        RegExpFilter.typeMap.GENERICBLOCK);

/**
 * Class for blocking filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} regexpSource see {@link RegExpFilter RegExpFilter()}
 * @param {number} [contentType] see {@link RegExpFilter RegExpFilter()}
 * @param {boolean} [matchCase] see {@link RegExpFilter RegExpFilter()}
 * @param {string} [domains] see {@link RegExpFilter RegExpFilter()}
 * @param {boolean} [thirdParty] see {@link RegExpFilter RegExpFilter()}
 * @param {string} [sitekeys] see {@link RegExpFilter RegExpFilter()}
 * @param {boolean} [collapse]
 *   defines whether the filter should collapse blocked content, can be null
 * @param {string} [csp]
 *   Content Security Policy to inject when the filter matches
 * @param {?string} [rewrite]
 *   The (optional) rule specifying how to rewrite the URL. See
 *   BlockingFilter.prototype.rewrite.
 * @constructor
 * @augments RegExpFilter
 */
function BlockingFilter(text, regexpSource, contentType, matchCase, domains,
                        thirdParty, sitekeys, collapse, csp, rewrite)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains,
                    thirdParty, sitekeys);

  if (collapse != null)
    this.collapse = collapse;

  if (csp != null)
    this.csp = csp;

  if (rewrite != null)
    this.rewrite = rewrite;
}
exports.BlockingFilter = BlockingFilter;

BlockingFilter.prototype = extend(RegExpFilter, {
  type: "blocking",

  /**
   * Defines whether the filter should collapse blocked content.
   * Can be null (use the global preference).
   * @type {?boolean}
   */
  collapse: null,

  /**
   * Content Security Policy to inject for matching requests.
   * @type {?string}
   */
  csp: null,

  /**
   * The rule specifying how to rewrite the URL.
   * The syntax is similar to the one of String.prototype.replace().
   * @type {?string}
   */
  rewrite: null,

  /**
   * Rewrites an URL.
   * @param {string} url the URL to rewrite
   * @return {string} the rewritten URL, or the original in case of failure
   */
  rewriteUrl(url)
  {
    try
    {
      let rewrittenUrl = new URL(url.replace(this.regexp, this.rewrite), url);
      if (rewrittenUrl.origin == new URL(url).origin)
        return rewrittenUrl.href;
    }
    catch (e)
    {
    }

    return url;
  }
});

/**
 * Class for whitelist filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} regexpSource see {@link RegExpFilter RegExpFilter()}
 * @param {number} [contentType] see {@link RegExpFilter RegExpFilter()}
 * @param {boolean} [matchCase] see {@link RegExpFilter RegExpFilter()}
 * @param {string} [domains] see {@link RegExpFilter RegExpFilter()}
 * @param {boolean} [thirdParty] see {@link RegExpFilter RegExpFilter()}
 * @param {string} [sitekeys] see {@link RegExpFilter RegExpFilter()}
 * @constructor
 * @augments RegExpFilter
 */
function WhitelistFilter(text, regexpSource, contentType, matchCase, domains,
                         thirdParty, sitekeys)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains,
                    thirdParty, sitekeys);
}
exports.WhitelistFilter = WhitelistFilter;

WhitelistFilter.prototype = extend(RegExpFilter, {
  type: "whitelist"
});

/**
 * Base class for content filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} [domains] Host names or domains the filter should be
 *                           restricted to
 * @param {string} body      The body of the filter
 * @constructor
 * @augments ActiveFilter
 */
function ContentFilter(text, domains, body)
{
  ActiveFilter.call(this, text, domains || null);

  this.body = body;
}
exports.ContentFilter = ContentFilter;

ContentFilter.prototype = extend(ActiveFilter, {
  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: ",",

  /**
   * The body of the filter
   * @type {string}
   */
  body: null
});

/**
 * Creates a content filter from a pre-parsed text representation
 *
 * @param {string} text         same as in Filter()
 * @param {string} [domains]
 *   domains part of the text representation
 * @param {string} [type]
 *   rule type, either:
 *     <li>"" for an element hiding filter</li>
 *     <li>"@" for an element hiding exception filter</li>
 *     <li>"?" for an element hiding emulation filter</li>
 *     <li>"$" for a snippet filter</li>
 * @param {string} body
 *   body part of the text representation, either a CSS selector or a snippet
 *   script
 * @return {ElemHideFilter|ElemHideException|
 *          ElemHideEmulationFilter|SnippetFilter|InvalidFilter}
 */
ContentFilter.fromText = function(text, domains, type, body)
{
  // We don't allow content filters which have any empty domains.
  // Note: The ContentFilter.prototype.domainSeparator is duplicated here, if
  // that changes this must be changed too.
  if (domains && /(^|,)~?(,|$)/.test(domains))
    return new InvalidFilter(text, "filter_invalid_domain");

  if (type == "@")
    return new ElemHideException(text, domains, body);

  if (type == "?" || type == "$")
  {
    // Element hiding emulation and snippet filters are inefficient so we need
    // to make sure that they're only applied if they specify active domains
    if (!(/,[^~][^,.]*\.[^,]/.test("," + domains) ||
          ("," + domains + ",").includes(",localhost,")))
    {
      return new InvalidFilter(text, type == "?" ?
                                       "filter_elemhideemulation_nodomain" :
                                       "filter_snippet_nodomain");
    }

    if (type == "?")
      return new ElemHideEmulationFilter(text, domains, body);

    return new SnippetFilter(text, domains, body);
  }

  return new ElemHideFilter(text, domains, body);
};

/**
 * Base class for element hiding filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} [domains] see {@link ContentFilter ContentFilter()}
 * @param {string} selector  CSS selector for the HTML elements that should be
 *                           hidden
 * @constructor
 * @augments ContentFilter
 */
function ElemHideBase(text, domains, selector)
{
  ContentFilter.call(this, text, domains, selector);
}
exports.ElemHideBase = ElemHideBase;

ElemHideBase.prototype = extend(ContentFilter, {
  /**
   * CSS selector for the HTML elements that should be hidden
   * @type {string}
   */
  get selector()
  {
    // Braces are being escaped to prevent CSS rule injection.
    return this.body.replace("{", "\\7B ").replace("}", "\\7D ");
  }
});

/**
 * Class for element hiding filters
 * @param {string} text see {@link Filter Filter()}
 * @param {string} [domains]  see {@link ElemHideBase ElemHideBase()}
 * @param {string} selector see {@link ElemHideBase ElemHideBase()}
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideFilter(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideFilter = ElemHideFilter;

ElemHideFilter.prototype = extend(ElemHideBase, {
  type: "elemhide"
});

/**
 * Class for element hiding exceptions
 * @param {string} text see {@link Filter Filter()}
 * @param {string} [domains]  see {@link ElemHideBase ElemHideBase()}
 * @param {string} selector see {@link ElemHideBase ElemHideBase()}
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideException(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideException = ElemHideException;

ElemHideException.prototype = extend(ElemHideBase, {
  type: "elemhideexception"
});

/**
 * Class for element hiding emulation filters
 * @param {string} text           see {@link Filter Filter()}
 * @param {string} domains        see {@link ElemHideBase ElemHideBase()}
 * @param {string} selector       see {@link ElemHideBase ElemHideBase()}
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideEmulationFilter(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideEmulationFilter = ElemHideEmulationFilter;

ElemHideEmulationFilter.prototype = extend(ElemHideBase, {
  type: "elemhideemulation"
});

/**
 * Class for snippet filters
 * @param {string} text see Filter()
 * @param {string} [domains] see ContentFilter()
 * @param {string} script    Script that should be executed
 * @constructor
 * @augments ContentFilter
 */
function SnippetFilter(text, domains, script)
{
  ContentFilter.call(this, text, domains, script);
}
exports.SnippetFilter = SnippetFilter;

SnippetFilter.prototype = extend(ContentFilter, {
  type: "snippet",

  /**
   * Script that should be executed
   * @type {string}
   */
  get script()
  {
    return this.body;
  }
});


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



let platformVersion = null;
let application = null;
let applicationVersion;

let regexp = /(\S+)\/(\S+)(?:\s*\(.*?\))?/g;
let match;

while (match = regexp.exec(navigator.userAgent))
{
  let app = match[1];
  let ver = match[2];

  if (app == "Chrome")
  {
    platformVersion = ver;
  }
  else if (app != "Mozilla" && app != "AppleWebKit" && app != "Safari")
  {
    // For compatibility with legacy websites, Chrome's UA
    // also includes a Mozilla, AppleWebKit and Safari token.
    // Any further name/version pair indicates a fork.
    application = app == "OPR" ? "opera" : app.toLowerCase();
    applicationVersion = ver;
  }
}

// not a Chromium-based UA, probably modifed by the user
if (!platformVersion)
{
  application = "unknown";
  applicationVersion = platformVersion = "0";
}

// no additional name/version, so this is upstream Chrome
if (!application)
{
  application = "chrome";
  applicationVersion = platformVersion;
}


exports.addonName = "adblockforchrome";
exports.addonVersion = "3.39.0";

exports.application = application;
exports.applicationVersion = applicationVersion;

exports.platform = "chromium";
exports.platformVersion = platformVersion;

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * @fileOverview This component manages listeners and calls them to distribute
 * messages about filter changes.
 */

const {EventEmitter} = __webpack_require__(7);

/**
 * This object allows registering and triggering listeners for filter events.
 * @type {EventEmitter}
 */
let filterNotifier = new EventEmitter();

exports.filterNotifier = filterNotifier;


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module prefs */



const {EventEmitter} = __webpack_require__(7);

const keyPrefix = "pref:";

let eventEmitter = new EventEmitter();
let overrides = Object.create(null);

/** @lends module:prefs.Prefs */
let defaults = Object.create(null);

/**
 * Only for compatibility with core code. Please do not change!
 *
 * @type {boolean}
 */
defaults.enabled = true;
/**
 * The application version as set during initialization. Used to detect updates.
 *
 * @type {string}
 */
defaults.currentVersion = "";
/**
 * Only for compatibility with core code. Please do not change!
 *
 * @type {string}
 */
defaults.data_directory = "";
/**
 * @see https://adblockplus.org/en/preferences#patternsbackups
 * @type {number}
 */
defaults.patternsbackups = 0;
/**
 * @see https://adblockplus.org/en/preferences#patternsbackupinterval
 * @type {number}
 */
defaults.patternsbackupinterval = 24;
/**
 * Only for compatibility with core code. Please do not change!
 *
 * @type {boolean}
 */
defaults.savestats = false;
/**
 * Only for compatibility with core code. Please do not change!
 *
 * @type {boolean}
 */
defaults.privateBrowsing = false;
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_fallbackerrors
 * @type {number}
 */
defaults.subscriptions_fallbackerrors = 5;
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_fallbackurl
 * @type {string}
 */
defaults.subscriptions_fallbackurl = "https://adblockplus.org/getSubscription?version=%VERSION%&url=%SUBSCRIPTION%&downloadURL=%URL%&error=%ERROR%&channelStatus=%CHANNELSTATUS%&responseStatus=%RESPONSESTATUS%";
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_autoupdate
 * @type {boolean}
 */
defaults.subscriptions_autoupdate = true;
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_exceptionsurl
 * @type {string}
 */
defaults.subscriptions_exceptionsurl = "https://easylist-downloads.adblockplus.org/exceptionrules.txt";
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_exceptionsurl_privacy
 * @type {string}
 */
defaults.subscriptions_exceptionsurl_privacy = "https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly.txt";
/**
 * @see https://adblockplus.org/en/preferences#subscriptions_antiadblockurl
 * @type {string}
 */
defaults.subscriptions_antiadblockurl = "https://easylist-downloads.adblockplus.org/antiadblockfilters.txt";
/**
 * Used to ensure the anti-circumvention subscription is opted in by default.
 * @type {boolean}
 */
defaults.subscriptions_addedanticv = false;
/**
 * @see https://adblockplus.org/en/preferences#documentation_link
 * @type {string}
 */
defaults.documentation_link = "https://adblockplus.org/redirect?link=%LINK%&lang=%LANG%";
/**
 * @see https://adblockplus.org/en/preferences#notificationdata
 * @type {object}
 */
defaults.notificationdata = {};
/**
 * @see https://adblockplus.org/en/preferences#notificationurl
 * @type {string}
 */
defaults.notificationurl = "https://notification.adblockplus.org/notification.json";
/**
 * The total number of requests blocked by the extension.
 *
 * @type {number}
 */
defaults.blocked_total = 0;
/**
 * Whether to show a badge in the toolbar icon indicating the number
 * of blocked ads.
 *
 * @type {boolean}
 */
defaults.show_statsinicon = true;
/**
 * Whether to show the number of blocked ads in the popup.
 *
 * @type {boolean}
 */
defaults.show_statsinpopup = true;
/**
 * Whether to show the "Block element" context menu entry.
 *
 * @type {boolean}
 */
defaults.shouldShowBlockElementMenu = true;
/**
 * Whether to collapse placeholders for blocked elements.
 *
 * @type {boolean}
 */
defaults.hidePlaceholders = true;

/**
 * Whether notification opt-out UI should be shown.
 * @type {boolean}
 */
defaults.notifications_showui = false;

/**
 * Whether to show tracking warning in options page when both
 * Acceptable Ads and subscription of type "Privacy" are enabled.
 *
 * @type {boolean}
 */
defaults.ui_warn_tracking = true;

/**
 * Determines whether data has been cleaned up after upgrading from the legacy
 * extension on Firefox.
 *
 * @type {boolean}
 */
defaults.data_cleanup_done = false;

/**
 * Notification categories to be ignored.
 *
 * @type {string[]}
 */
defaults.notifications_ignoredcategories = [];

/**
 * Whether to show the developer tools panel.
 *
 * @type {boolean}
 */
defaults.show_devtools_panel = true;

/**
 * Whether to suppress the first run and updates page. This preference isn't
 * set by the extension but can be pre-configured externally.
 *
 * @see https://adblockplus.org/development-builds/suppressing-the-first-run-page-on-chrome
 * @type {boolean}
 */
defaults.suppress_first_run_page = false;

/**
 * Additonal subscriptions to be automatically added when the extension is
 * loaded. This preference isn't set by the extension but can be pre-configured
 * externally.
 *
 * @type {string[]}
 */
defaults.additional_subscriptions = [];

/**
 * The version of major updates that the user is aware of. If it's too low,
 * the updates page will be shown to inform the user about intermediate changes.
 *
 * @type {number}
 */
defaults.last_updates_page_displayed = 0;

/**
  * @namespace
  * @static
  */
let Prefs = exports.Prefs = {
  /**
   * Sets the given preference.
   *
   * @param {string} preference
   * @param {any}    value
   * @return {Promise} A promise that resolves when the underlying
                       browser.storage.local.set/remove() operation completes
   */
  set(preference, value)
  {
    let defaultValue = defaults[preference];

    if (typeof value != typeof defaultValue)
      throw new Error("Attempt to change preference type");

    if (value == defaultValue)
    {
      delete overrides[preference];
      return browser.storage.local.remove(prefToKey(preference));
    }

    overrides[preference] = value;
    return (customSave.get(preference) || savePref)(preference);
  },

  /**
   * Adds a callback that is called when the
   * value of a specified preference changed.
   *
   * @param {string}   preference
   * @param {function} callback
   */
  on(preference, callback)
  {
    eventEmitter.on(preference, callback);
  },

  /**
   * Removes a callback for the specified preference.
   *
   * @param {string}   preference
   * @param {function} callback
   */
  off(preference, callback)
  {
    eventEmitter.off(preference, callback);
  },

  /**
   * A promise that is fullfilled when all preferences have been loaded.
   * Wait for this promise to be fulfilled before using preferences during
   * extension initialization.
   *
   * @type {Promise}
   */
  untilLoaded: null
};

function keyToPref(key)
{
  if (key.indexOf(keyPrefix) != 0)
    return null;

  return key.substr(keyPrefix.length);
}

function prefToKey(pref)
{
  return keyPrefix + pref;
}

function savePref(pref)
{
  return browser.storage.local.set({[prefToKey(pref)]: overrides[pref]});
}

let customSave = new Map();
if (__webpack_require__(1).platform == "gecko")
{
  // Saving one storage value causes all others to be saved as well on Gecko.
  // Make sure that updating ad counter doesn't cause the filters data to be
  // saved frequently as a side-effect.
  let promise = null;
  customSave.set("blocked_total", pref =>
  {
    if (!promise)
    {
      promise = new Promise((resolve, reject) =>
      {
        setTimeout(
          () =>
          {
            promise = null;
            savePref(pref).then(resolve, reject);
          },
          60 * 1000
        );
      });
    }
    return promise;
  });
}

function addPreference(pref)
{
  Object.defineProperty(Prefs, pref, {
    get() { return (pref in overrides ? overrides : defaults)[pref]; },
    set(value)
    {
      Prefs.set(pref, value);
    },
    enumerable: true
  });
}

function init()
{
  let prefs = Object.keys(defaults);
  prefs.forEach(addPreference);

  let localLoaded = browser.storage.local.get(prefs.map(prefToKey)).then(
    items =>
    {
      for (let key in items)
        overrides[keyToPref(key)] = items[key];
    }
  );

  let managedLoaded;
  if ("managed" in browser.storage)
  {
    managedLoaded = browser.storage.managed.get(null).then(
      items =>
      {
        for (let key in items)
          defaults[key] = items[key];
      },

      // Opera doesn't support browser.storage.managed, but instead of simply
      // removing the API, it gives an asynchronous error which we ignore here.
      () => {}
    );
  }
  else
  {
    managedLoaded = Promise.resolve();
  }

  function onLoaded()
  {
    browser.storage.onChanged.addListener(changes =>
    {
      for (let key in changes)
      {
        let pref = keyToPref(key);
        if (pref && pref in defaults)
        {
          let change = changes[key];
          if ("newValue" in change && change.newValue != defaults[pref])
            overrides[pref] = change.newValue;
          else
            delete overrides[pref];

          eventEmitter.emit(pref);
        }
      }
    });
  }

  Prefs.untilLoaded = Promise.all([localLoaded, managedLoaded]).then(onLoaded);
}

init();


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * @fileOverview FilterStorage class responsible for managing user's
 *               subscriptions and filters.
 */

const {IO} = __webpack_require__(12);
const {Prefs} = __webpack_require__(3);
const {Filter, ActiveFilter} = __webpack_require__(0);
const {Subscription, SpecialSubscription,
       ExternalSubscription} = __webpack_require__(5);
const {filterNotifier} = __webpack_require__(2);
const {INIParser} = __webpack_require__(21);

/**
 * Version number of the filter storage file format.
 * @type {number}
 */
let formatVersion = 5;

/**
 * This class reads user's filters from disk, manages them in memory
 * and writes them back.
 * @class
 */
let FilterStorage = exports.FilterStorage =
{
  /**
   * Will be set to true after the initial loadFromDisk() call completes.
   * @type {boolean}
   */
  initialized: false,

  /**
   * Version number of the patterns.ini format used.
   * @type {number}
   */
  get formatVersion()
  {
    return formatVersion;
  },

  /**
   * File containing the filter list
   * @type {string}
   */
  get sourceFile()
  {
    return "patterns.ini";
  },

  /**
   * Will be set to true if no patterns.ini file exists.
   * @type {boolean}
   */
  firstRun: false,

  /**
   * Map of properties listed in the filter storage file before the sections
   * start. Right now this should be only the format version.
   */
  fileProperties: Object.create(null),

  /**
   * List of filter subscriptions containing all filters
   * @type {Subscription[]}
   */
  subscriptions: [],

  /**
   * Map of subscriptions already on the list, by their URL/identifier
   * @type {Map.<string,Subscription>}
   */
  knownSubscriptions: new Map(),

  /**
   * Finds the filter group that a filter should be added to by default. Will
   * return null if this group doesn't exist yet.
   * @param {Filter} filter
   * @return {?SpecialSubscription}
   */
  getGroupForFilter(filter)
  {
    let generalSubscription = null;
    for (let subscription of FilterStorage.subscriptions)
    {
      if (subscription instanceof SpecialSubscription && !subscription.disabled)
      {
        // Always prefer specialized subscriptions
        if (subscription.isDefaultFor(filter))
          return subscription;

        // If this is a general subscription - store it as fallback
        if (!generalSubscription &&
            (!subscription.defaults || !subscription.defaults.length))
        {
          generalSubscription = subscription;
        }
      }
    }
    return generalSubscription;
  },

  /**
   * Adds a filter subscription to the list
   * @param {Subscription} subscription filter subscription to be added
   */
  addSubscription(subscription)
  {
    if (FilterStorage.knownSubscriptions.has(subscription.url))
      return;

    FilterStorage.subscriptions.push(subscription);
    FilterStorage.knownSubscriptions.set(subscription.url, subscription);
    addSubscriptionFilters(subscription);

    filterNotifier.emit("subscription.added", subscription);
  },

  /**
   * Removes a filter subscription from the list
   * @param {Subscription} subscription filter subscription to be removed
   */
  removeSubscription(subscription)
  {
    for (let i = 0; i < FilterStorage.subscriptions.length; i++)
    {
      if (FilterStorage.subscriptions[i].url == subscription.url)
      {
        removeSubscriptionFilters(subscription);

        FilterStorage.subscriptions.splice(i--, 1);
        FilterStorage.knownSubscriptions.delete(subscription.url);

        // This should be the last remaining reference to the Subscription
        // object.
        Subscription.knownSubscriptions.delete(subscription.url);

        filterNotifier.emit("subscription.removed", subscription);
        return;
      }
    }
  },

  /**
   * Moves a subscription in the list to a new position.
   * @param {Subscription} subscription filter subscription to be moved
   * @param {Subscription} [insertBefore] filter subscription to insert before
   *        (if omitted the subscription will be put at the end of the list)
   */
  moveSubscription(subscription, insertBefore)
  {
    let currentPos = FilterStorage.subscriptions.indexOf(subscription);
    if (currentPos < 0)
      return;

    let newPos = -1;
    if (insertBefore)
      newPos = FilterStorage.subscriptions.indexOf(insertBefore);

    if (newPos < 0)
      newPos = FilterStorage.subscriptions.length;

    if (currentPos < newPos)
      newPos--;
    if (currentPos == newPos)
      return;

    FilterStorage.subscriptions.splice(currentPos, 1);
    FilterStorage.subscriptions.splice(newPos, 0, subscription);
    filterNotifier.emit("subscription.moved", subscription);
  },

  /**
   * Replaces the list of filters in a subscription by a new list
   * @param {Subscription} subscription filter subscription to be updated
   * @param {Filter[]} filters new filter list
   */
  updateSubscriptionFilters(subscription, filters)
  {
    removeSubscriptionFilters(subscription);
    let oldFilters = subscription.filters;
    subscription.filters = filters;
    addSubscriptionFilters(subscription);
    filterNotifier.emit("subscription.updated", subscription, oldFilters);
  },

  /**
   * Adds a user-defined filter to the list
   * @param {Filter} filter
   * @param {SpecialSubscription} [subscription]
   *   particular group that the filter should be added to
   * @param {number} [position]
   *   position within the subscription at which the filter should be added
   */
  addFilter(filter, subscription, position)
  {
    if (!subscription)
    {
      for (let currentSubscription of filter.subscriptions())
      {
        if (currentSubscription instanceof SpecialSubscription &&
            !currentSubscription.disabled)
        {
          return;   // No need to add
        }
      }
      subscription = FilterStorage.getGroupForFilter(filter);
    }
    if (!subscription)
    {
      // No group for this filter exists, create one
      subscription = SpecialSubscription.createForFilter(filter);
      this.addSubscription(subscription);
      return;
    }

    if (typeof position == "undefined")
      position = subscription.filters.length;

    filter.addSubscription(subscription);
    subscription.filters.splice(position, 0, filter);
    filterNotifier.emit("filter.added", filter, subscription, position);
  },

  /**
   * Removes a user-defined filter from the list
   * @param {Filter} filter
   * @param {SpecialSubscription} [subscription] a particular filter group that
   *      the filter should be removed from (if ommited will be removed from all
   *      subscriptions)
   * @param {number} [position]  position inside the filter group at which the
   *      filter should be removed (if ommited all instances will be removed)
   */
  removeFilter(filter, subscription, position)
  {
    let subscriptions = (
      subscription ? [subscription] : filter.subscriptions()
    );
    for (let currentSubscription of subscriptions)
    {
      if (currentSubscription instanceof SpecialSubscription)
      {
        let positions = [];
        if (typeof position == "undefined")
        {
          let index = -1;
          do
          {
            index = currentSubscription.filters.indexOf(filter, index + 1);
            if (index >= 0)
              positions.push(index);
          } while (index >= 0);
        }
        else
          positions.push(position);

        for (let j = positions.length - 1; j >= 0; j--)
        {
          let currentPosition = positions[j];
          if (currentSubscription.filters[currentPosition] == filter)
          {
            currentSubscription.filters.splice(currentPosition, 1);
            if (currentSubscription.filters.indexOf(filter) < 0)
              filter.removeSubscription(currentSubscription);
            filterNotifier.emit("filter.removed", filter, currentSubscription,
                                currentPosition);
          }
        }
      }
    }
  },

  /**
   * Moves a user-defined filter to a new position
   * @param {Filter} filter
   * @param {SpecialSubscription} subscription filter group where the filter is
   *                                           located
   * @param {number} oldPosition current position of the filter
   * @param {number} newPosition new position of the filter
   */
  moveFilter(filter, subscription, oldPosition, newPosition)
  {
    if (!(subscription instanceof SpecialSubscription) ||
        subscription.filters[oldPosition] != filter)
    {
      return;
    }

    newPosition = Math.min(Math.max(newPosition, 0),
                           subscription.filters.length - 1);
    if (oldPosition == newPosition)
      return;

    subscription.filters.splice(oldPosition, 1);
    subscription.filters.splice(newPosition, 0, filter);
    filterNotifier.emit("filter.moved", filter, subscription, oldPosition,
                        newPosition);
  },

  /**
   * Increases the hit count for a filter by one
   * @param {Filter} filter
   */
  increaseHitCount(filter)
  {
    if (!Prefs.savestats || !(filter instanceof ActiveFilter))
      return;

    filter.hitCount++;
    filter.lastHit = Date.now();
  },

  /**
   * Resets hit count for some filters
   * @param {Filter[]} filters  filters to be reset, if null all filters will
   *                            be reset
   */
  resetHitCounts(filters)
  {
    if (!filters)
      filters = Filter.knownFilters.values();
    for (let filter of filters)
    {
      filter.hitCount = 0;
      filter.lastHit = 0;
    }
  },

  /**
   * @callback TextSink
   * @param {string?} line
   */

  /**
   * Allows importing previously serialized filter data.
   * @param {boolean} silent
   *    If true, no "load" notification will be sent out.
   * @return {TextSink}
   *    Function to be called for each line of data. Calling it with null as
   *    parameter finalizes the import and replaces existing data. No changes
   *    will be applied before finalization, so import can be "aborted" by
   *    forgetting this callback.
   */
  importData(silent)
  {
    let parser = new INIParser();
    return line =>
    {
      parser.process(line);
      if (line === null)
      {
        let knownSubscriptions = new Map();
        for (let subscription of parser.subscriptions)
          knownSubscriptions.set(subscription.url, subscription);

        this.fileProperties = parser.fileProperties;
        this.subscriptions = parser.subscriptions;
        this.knownSubscriptions = knownSubscriptions;
        Filter.knownFilters = parser.knownFilters;
        Subscription.knownSubscriptions = parser.knownSubscriptions;

        if (!silent)
          filterNotifier.emit("load");
      }
    };
  },

  /**
   * Loads all subscriptions from the disk.
   * @return {Promise} promise resolved or rejected when loading is complete
   */
  loadFromDisk()
  {
    let tryBackup = backupIndex =>
    {
      return this.restoreBackup(backupIndex, true).then(() =>
      {
        if (this.subscriptions.length == 0)
          return tryBackup(backupIndex + 1);
      }).catch(error =>
      {
        // Give up
      });
    };

    return IO.statFile(this.sourceFile).then(statData =>
    {
      if (!statData.exists)
      {
        this.firstRun = true;
        return;
      }

      let parser = this.importData(true);
      return IO.readFromFile(this.sourceFile, parser).then(() =>
      {
        parser(null);
        if (this.subscriptions.length == 0)
        {
          // No filter subscriptions in the file, this isn't right.
          throw new Error("No data in the file");
        }
      });
    }).catch(error =>
    {
      Cu.reportError(error);
      return tryBackup(1);
    }).then(() =>
    {
      this.initialized = true;
      filterNotifier.emit("load");
    });
  },

  /**
   * Constructs the file name for a patterns.ini backup.
   * @param {number} backupIndex
   *    number of the backup file (1 being the most recent)
   * @return {string} backup file name
   */
  getBackupName(backupIndex)
  {
    let [name, extension] = this.sourceFile.split(".", 2);
    return (name + "-backup" + backupIndex + "." + extension);
  },

  /**
   * Restores an automatically created backup.
   * @param {number} backupIndex
   *    number of the backup to restore (1 being the most recent)
   * @param {boolean} silent
   *    If true, no "load" notification will be sent out.
   * @return {Promise} promise resolved or rejected when restoring is complete
   */
  restoreBackup(backupIndex, silent)
  {
    let backupFile = this.getBackupName(backupIndex);
    let parser = this.importData(silent);
    return IO.readFromFile(backupFile, parser).then(() =>
    {
      parser(null);
      return this.saveToDisk();
    });
  },

  /**
   * Generator serializing filter data and yielding it line by line.
   */
  *exportData()
  {
    // Do not persist external subscriptions
    let subscriptions = this.subscriptions.filter(
      s => !(s instanceof ExternalSubscription)
    );

    yield "# Adblock Plus preferences";
    yield "version=" + formatVersion;

    let saved = new Set();
    let buf = [];

    // Save subscriptions
    for (let subscription of subscriptions)
    {
      yield "";

      subscription.serialize(buf);
      if (subscription.filters.length)
      {
        buf.push("", "[Subscription filters]");
        subscription.serializeFilters(buf);
      }
      for (let line of buf)
        yield line;
      buf.splice(0);
    }

    // Save filter data
    for (let subscription of subscriptions)
    {
      for (let filter of subscription.filters)
      {
        if (!saved.has(filter.text))
        {
          filter.serialize(buf);
          saved.add(filter.text);
          for (let line of buf)
            yield line;
          buf.splice(0);
        }
      }
    }
  },

  /**
   * Will be set to true if saveToDisk() is running (reentrance protection).
   * @type {boolean}
   */
  _saving: false,

  /**
   * Will be set to true if a saveToDisk() call arrives while saveToDisk() is
   * already running (delayed execution).
   * @type {boolean}
   */
  _needsSave: false,

  /**
   * Saves all subscriptions back to disk
   * @return {Promise} promise resolved or rejected when saving is complete
   */
  saveToDisk()
  {
    if (this._saving)
    {
      this._needsSave = true;
      return;
    }

    this._saving = true;

    return Promise.resolve().then(() =>
    {
      // First check whether we need to create a backup
      if (Prefs.patternsbackups <= 0)
        return false;

      return IO.statFile(this.sourceFile).then(statData =>
      {
        if (!statData.exists)
          return false;

        return IO.statFile(this.getBackupName(1)).then(backupStatData =>
        {
          if (backupStatData.exists &&
              (Date.now() - backupStatData.lastModified) / 3600000 <
                Prefs.patternsbackupinterval)
          {
            return false;
          }
          return true;
        });
      });
    }).then(backupRequired =>
    {
      if (!backupRequired)
        return;

      let ignoreErrors = error =>
      {
        // Expected error, backup file doesn't exist.
      };

      let renameBackup = index =>
      {
        if (index > 0)
        {
          return IO.renameFile(this.getBackupName(index),
                               this.getBackupName(index + 1))
                   .catch(ignoreErrors)
                   .then(() => renameBackup(index - 1));
        }

        return IO.renameFile(this.sourceFile, this.getBackupName(1))
                 .catch(ignoreErrors);
      };

      // Rename existing files
      return renameBackup(Prefs.patternsbackups - 1);
    }).catch(error =>
    {
      // Errors during backup creation shouldn't prevent writing filters.
      Cu.reportError(error);
    }).then(() =>
    {
      return IO.writeToFile(this.sourceFile, this.exportData());
    }).then(() =>
    {
      filterNotifier.emit("save");
    }).catch(error =>
    {
      // If saving failed, report error but continue - we still have to process
      // flags.
      Cu.reportError(error);
    }).then(() =>
    {
      this._saving = false;
      if (this._needsSave)
      {
        this._needsSave = false;
        this.saveToDisk();
      }
    });
  },

  /**
   * @typedef FileInfo
   * @type {object}
   * @property {number} index
   * @property {number} lastModified
   */

  /**
   * Returns a promise resolving in a list of existing backup files.
   * @return {Promise.<FileInfo[]>}
   */
  getBackupFiles()
  {
    let backups = [];

    let checkBackupFile = index =>
    {
      return IO.statFile(this.getBackupName(index)).then(statData =>
      {
        if (!statData.exists)
          return backups;

        backups.push({
          index,
          lastModified: statData.lastModified
        });
        return checkBackupFile(index + 1);
      }).catch(error =>
      {
        // Something went wrong, return whatever data we got so far.
        Cu.reportError(error);
        return backups;
      });
    };

    return checkBackupFile(1);
  }
};

/**
 * Joins subscription's filters to the subscription without any notifications.
 * @param {Subscription} subscription
 *   filter subscription that should be connected to its filters
 */
function addSubscriptionFilters(subscription)
{
  if (!FilterStorage.knownSubscriptions.has(subscription.url))
    return;

  for (let filter of subscription.filters)
    filter.addSubscription(subscription);
}

/**
 * Removes subscription's filters from the subscription without any
 * notifications.
 * @param {Subscription} subscription filter subscription to be removed
 */
function removeSubscriptionFilters(subscription)
{
  if (!FilterStorage.knownSubscriptions.has(subscription.url))
    return;

  for (let filter of subscription.filters)
    filter.removeSubscription(subscription);
}


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * @fileOverview Definition of Subscription class and its subclasses.
 */

const {ActiveFilter, BlockingFilter,
       WhitelistFilter, ElemHideBase} = __webpack_require__(0);
const {filterNotifier} = __webpack_require__(2);
const {extend} = __webpack_require__(13);

/**
 * Abstract base class for filter subscriptions
 *
 * @param {string} url    download location of the subscription
 * @param {string} [title]  title of the filter subscription
 * @constructor
 */
function Subscription(url, title)
{
  this.url = url;
  this.filters = [];
  if (title)
    this._title = title;
  Subscription.knownSubscriptions.set(url, this);
}
exports.Subscription = Subscription;

Subscription.prototype =
{
  /**
   * Download location of the subscription
   * @type {string}
   */
  url: null,

  /**
   * Type of the subscription
   * @type {?string}
   */
  type: null,

  /**
   * Filters contained in the filter subscription
   * @type {Filter[]}
   */
  filters: null,

  _title: null,
  _fixedTitle: false,
  _disabled: false,

  /**
   * Title of the filter subscription
   * @type {string}
   */
  get title()
  {
    return this._title;
  },
  set title(value)
  {
    if (value != this._title)
    {
      let oldValue = this._title;
      this._title = value;
      filterNotifier.emit("subscription.title", this, value, oldValue);
    }
    return this._title;
  },

  /**
   * Determines whether the title should be editable
   * @type {boolean}
   */
  get fixedTitle()
  {
    return this._fixedTitle;
  },
  set fixedTitle(value)
  {
    if (value != this._fixedTitle)
    {
      let oldValue = this._fixedTitle;
      this._fixedTitle = value;
      filterNotifier.emit("subscription.fixedTitle", this, value, oldValue);
    }
    return this._fixedTitle;
  },

  /**
   * Defines whether the filters in the subscription should be disabled
   * @type {boolean}
   */
  get disabled()
  {
    return this._disabled;
  },
  set disabled(value)
  {
    if (value != this._disabled)
    {
      let oldValue = this._disabled;
      this._disabled = value;
      filterNotifier.emit("subscription.disabled", this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * Serializes the subscription to an array of strings for writing
   * out on the disk.
   * @param {string[]} buffer  buffer to push the serialization results into
   */
  serialize(buffer)
  {
    buffer.push("[Subscription]");
    buffer.push("url=" + this.url);
    if (this.type)
      buffer.push("type=" + this.type);
    if (this._title)
      buffer.push("title=" + this._title);
    if (this._fixedTitle)
      buffer.push("fixedTitle=true");
    if (this._disabled)
      buffer.push("disabled=true");
  },

  serializeFilters(buffer)
  {
    for (let filter of this.filters)
      buffer.push(filter.text.replace(/\[/g, "\\["));
  },

  toString()
  {
    let buffer = [];
    this.serialize(buffer);
    return buffer.join("\n");
  }
};

/**
 * Cache for known filter subscriptions, maps URL to subscription objects.
 * @type {Map.<string,Subscription>}
 */
Subscription.knownSubscriptions = new Map();

/**
 * Returns a subscription from its URL, creates a new one if necessary.
 * @param {string} url
 *   URL of the subscription
 * @return {Subscription}
 *   subscription or null if the subscription couldn't be created
 */
Subscription.fromURL = function(url)
{
  let subscription = Subscription.knownSubscriptions.get(url);
  if (subscription)
    return subscription;

  if (url[0] != "~")
    return new DownloadableSubscription(url, null);
  return new SpecialSubscription(url);
};

/**
 * Deserializes a subscription
 *
 * @param {Object}  obj
 *   map of serialized properties and their values
 * @return {Subscription}
 *   subscription or null if the subscription couldn't be created
 */
Subscription.fromObject = function(obj)
{
  let result;
  if (obj.url[0] != "~")
  {
    // URL is valid - this is a downloadable subscription
    result = new DownloadableSubscription(obj.url, obj.title);
    if ("type" in obj)
      result.type = obj.type;
    if ("downloadStatus" in obj)
      result._downloadStatus = obj.downloadStatus;
    if ("lastSuccess" in obj)
      result.lastSuccess = parseInt(obj.lastSuccess, 10) || 0;
    if ("lastCheck" in obj)
      result._lastCheck = parseInt(obj.lastCheck, 10) || 0;
    if ("expires" in obj)
      result.expires = parseInt(obj.expires, 10) || 0;
    if ("softExpiration" in obj)
      result.softExpiration = parseInt(obj.softExpiration, 10) || 0;
    if ("errors" in obj)
      result._errors = parseInt(obj.errors, 10) || 0;
    if ("version" in obj)
      result.version = parseInt(obj.version, 10) || 0;
    if ("requiredVersion" in obj)
      result.requiredVersion = obj.requiredVersion;
    if ("homepage" in obj)
      result._homepage = obj.homepage;
    if ("lastDownload" in obj)
      result._lastDownload = parseInt(obj.lastDownload, 10) || 0;
    if ("downloadCount" in obj)
      result.downloadCount = parseInt(obj.downloadCount, 10) || 0;
  }
  else
  {
    result = new SpecialSubscription(obj.url, obj.title);
    if ("defaults" in obj)
      result.defaults = obj.defaults.split(" ");
  }
  if ("fixedTitle" in obj)
    result._fixedTitle = (obj.fixedTitle == "true");
  if ("disabled" in obj)
    result._disabled = (obj.disabled == "true");

  return result;
};

/**
 * Class for special filter subscriptions (user's filters)
 * @param {string} url see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
 * @constructor
 * @augments Subscription
 */
function SpecialSubscription(url, title)
{
  Subscription.call(this, url, title);
}
exports.SpecialSubscription = SpecialSubscription;

SpecialSubscription.prototype = extend(Subscription, {
  /**
   * Filter types that should be added to this subscription by default
   * (entries should correspond to keys in SpecialSubscription.defaultsMap).
   * @type {string[]}
   */
  defaults: null,

  /**
   * Tests whether a filter should be added to this group by default
   * @param {Filter} filter filter to be tested
   * @return {boolean}
   */
  isDefaultFor(filter)
  {
    if (this.defaults && this.defaults.length)
    {
      for (let type of this.defaults)
      {
        if (filter instanceof SpecialSubscription.defaultsMap.get(type))
          return true;
        if (!(filter instanceof ActiveFilter) && type == "blacklist")
          return true;
      }
    }

    return false;
  },

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    Subscription.prototype.serialize.call(this, buffer);
    if (this.defaults && this.defaults.length)
    {
      buffer.push("defaults=" +
        this.defaults.filter(
          type => SpecialSubscription.defaultsMap.has(type)
        ).join(" ")
      );
    }
    if (this._lastDownload)
      buffer.push("lastDownload=" + this._lastDownload);
  }
});

SpecialSubscription.defaultsMap = new Map([
  ["whitelist", WhitelistFilter],
  ["blocking", BlockingFilter],
  ["elemhide", ElemHideBase]
]);

/**
 * Creates a new user-defined filter group.
 * @param {string} [title]  title of the new filter group
 * @return {SpecialSubscription}
 */
SpecialSubscription.create = function(title)
{
  let url;
  do
  {
    url = "~user~" + Math.round(Math.random() * 1000000);
  } while (Subscription.knownSubscriptions.has(url));
  return new SpecialSubscription(url, title);
};

/**
 * Creates a new user-defined filter group and adds the given filter to it.
 * This group will act as the default group for this filter type.
 * @param {Filter} filter
 * @return {SpecialSubscription}
 */
SpecialSubscription.createForFilter = function(filter)
{
  let subscription = SpecialSubscription.create();
  subscription.filters.push(filter);
  for (let [type, class_] of SpecialSubscription.defaultsMap)
  {
    if (filter instanceof class_)
      subscription.defaults = [type];
  }
  if (!subscription.defaults)
    subscription.defaults = ["blocking"];
  return subscription;
};

/**
 * Abstract base class for regular filter subscriptions (both
 * internally and externally updated)
 * @param {string} url    see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
 * @constructor
 * @augments Subscription
 */
function RegularSubscription(url, title)
{
  Subscription.call(this, url, title || url);
}
exports.RegularSubscription = RegularSubscription;

RegularSubscription.prototype = extend(Subscription, {
  _homepage: null,
  _lastDownload: 0,

  /**
   * Filter subscription homepage if known
   * @type {string}
   */
  get homepage()
  {
    return this._homepage;
  },
  set homepage(value)
  {
    if (value != this._homepage)
    {
      let oldValue = this._homepage;
      this._homepage = value;
      filterNotifier.emit("subscription.homepage", this, value, oldValue);
    }
    return this._homepage;
  },

  /**
   * Time of the last subscription download (in seconds since the
   * beginning of the epoch)
   * @type {number}
   */
  get lastDownload()
  {
    return this._lastDownload;
  },
  set lastDownload(value)
  {
    if (value != this._lastDownload)
    {
      let oldValue = this._lastDownload;
      this._lastDownload = value;
      filterNotifier.emit("subscription.lastDownload", this, value, oldValue);
    }
    return this._lastDownload;
  },

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    Subscription.prototype.serialize.call(this, buffer);
    if (this._homepage)
      buffer.push("homepage=" + this._homepage);
    if (this._lastDownload)
      buffer.push("lastDownload=" + this._lastDownload);
  }
});

/**
 * Class for filter subscriptions updated externally (by other extension)
 * @param {string} url    see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
 * @constructor
 * @augments RegularSubscription
 */
function ExternalSubscription(url, title)
{
  RegularSubscription.call(this, url, title);
}
exports.ExternalSubscription = ExternalSubscription;

ExternalSubscription.prototype = extend(RegularSubscription, {
  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    throw new Error(
      "Unexpected call, external subscriptions should not be serialized"
    );
  }
});

/**
 * Class for filter subscriptions updated externally (by other extension)
 * @param {string} url  see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
 * @constructor
 * @augments RegularSubscription
 */
function DownloadableSubscription(url, title)
{
  RegularSubscription.call(this, url, title);
}
exports.DownloadableSubscription = DownloadableSubscription;

DownloadableSubscription.prototype = extend(RegularSubscription, {
  _downloadStatus: null,
  _lastCheck: 0,
  _errors: 0,

  /**
   * Status of the last download (ID of a string)
   * @type {string}
   */
  get downloadStatus()
  {
    return this._downloadStatus;
  },
  set downloadStatus(value)
  {
    let oldValue = this._downloadStatus;
    this._downloadStatus = value;
    filterNotifier.emit("subscription.downloadStatus", this, value, oldValue);
    return this._downloadStatus;
  },

  /**
   * Time of the last successful download (in seconds since the beginning of the
   * epoch).
   */
  lastSuccess: 0,

  /**
   * Time when the subscription was considered for an update last time
   * (in seconds since the beginning of the epoch). This will be used
   * to increase softExpiration if the user doesn't use Adblock Plus
   * for some time.
   * @type {number}
   */
  get lastCheck()
  {
    return this._lastCheck;
  },
  set lastCheck(value)
  {
    if (value != this._lastCheck)
    {
      let oldValue = this._lastCheck;
      this._lastCheck = value;
      filterNotifier.emit("subscription.lastCheck", this, value, oldValue);
    }
    return this._lastCheck;
  },

  /**
   * Hard expiration time of the filter subscription (in seconds since
   * the beginning of the epoch)
   * @type {number}
   */
  expires: 0,

  /**
   * Soft expiration time of the filter subscription (in seconds since
   * the beginning of the epoch)
   * @type {number}
   */
  softExpiration: 0,

  /**
   * Number of download failures since last success
   * @type {number}
   */
  get errors()
  {
    return this._errors;
  },
  set errors(value)
  {
    if (value != this._errors)
    {
      let oldValue = this._errors;
      this._errors = value;
      filterNotifier.emit("subscription.errors", this, value, oldValue);
    }
    return this._errors;
  },

  /**
   * Version of the subscription data retrieved on last successful download
   * @type {number}
   */
  version: 0,

  /**
   * Minimal Adblock Plus version required for this subscription
   * @type {string}
   */
  requiredVersion: null,

  /**
   * Number indicating how often the object was downloaded.
   * @type {number}
   */
  downloadCount: 0,

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    RegularSubscription.prototype.serialize.call(this, buffer);
    if (this.downloadStatus)
      buffer.push("downloadStatus=" + this.downloadStatus);
    if (this.lastSuccess)
      buffer.push("lastSuccess=" + this.lastSuccess);
    if (this.lastCheck)
      buffer.push("lastCheck=" + this.lastCheck);
    if (this.expires)
      buffer.push("expires=" + this.expires);
    if (this.softExpiration)
      buffer.push("softExpiration=" + this.softExpiration);
    if (this.errors)
      buffer.push("errors=" + this.errors);
    if (this.version)
      buffer.push("version=" + this.version);
    if (this.requiredVersion)
      buffer.push("requiredVersion=" + this.requiredVersion);
    if (this.downloadCount)
      buffer.push("downloadCount=" + this.downloadCount);
  }
});


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



let Utils = exports.Utils = {
  systemPrincipal: null,
  runAsync(callback)
  {
    if (document.readyState == "loading")
    {
      // Make sure to not run asynchronous actions before all
      // scripts loaded. This caused issues on Opera in the past.
      let onDOMContentLoaded = () =>
      {
        document.removeEventListener("DOMContentLoaded", onDOMContentLoaded);
        callback();
      };
      document.addEventListener("DOMContentLoaded", onDOMContentLoaded);
    }
    else
    {
      setTimeout(callback, 0);
    }
  },
  get appLocale()
  {
    let locale = browser.i18n.getUILanguage();
    Object.defineProperty(this, "appLocale", {value: locale, enumerable: true});
    return this.appLocale;
  },
  get readingDirection()
  {
    let direction = browser.i18n.getMessage("@@bidi_dir");
    // This fallback is only necessary for Microsoft Edge
    if (!direction)
      direction = /^(?:ar|fa|he|ug|ur)\b/.test(this.appLocale) ? "rtl" : "ltr";
    Object.defineProperty(
      this,
      "readingDirection",
      {value: direction, enumerable: true}
    );
    return this.readingDirection;
  },

  getDocLink(linkID)
  {
    let docLink = __webpack_require__(3).Prefs.documentation_link;
    return docLink.replace(/%LINK%/g, linkID)
                  .replace(/%LANG%/g, Utils.appLocale);
  },

  yield()
  {
  }
};


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * Registers and emits named events.
 */
class EventEmitter
{
  constructor()
  {
    this._listeners = new Map();
  }

  /**
   * Adds a listener for the specified event name.
   *
   * @param {string}   name
   * @param {function} listener
   */
  on(name, listener)
  {
    let listeners = this._listeners.get(name);
    if (listeners)
      listeners.push(listener);
    else
      this._listeners.set(name, [listener]);
  }

  /**
   * Removes a listener for the specified event name.
   *
   * @param {string}   name
   * @param {function} listener
   */
  off(name, listener)
  {
    let listeners = this._listeners.get(name);
    if (listeners)
    {
      let idx = listeners.indexOf(listener);
      if (idx != -1)
        listeners.splice(idx, 1);
    }
  }

  /**
   * Adds a one time listener and returns a promise that
   * is resolved the next time the specified event is emitted.
   *
   * @param {string} name
   * @returns {Promise}
   */
  once(name)
  {
    return new Promise(resolve =>
    {
      let listener = () =>
      {
        this.off(name, listener);
        resolve();
      };

      this.on(name, listener);
    });
  }

  /**
   * Returns a copy of the array of listeners for the specified event.
   *
   * @param {string} name
   * @returns {Array.<function>}
   */
  listeners(name)
  {
    let listeners = this._listeners.get(name);
    return listeners ? listeners.slice() : [];
  }

  /**
   * Calls all previously added listeners for the given event name.
   *
   * @param {string} name
   * @param {...*}   [args]
   */
  emit(name, ...args)
  {
    let listeners = this.listeners(name);
    for (let listener of listeners)
      listener(...args);
  }
}

exports.EventEmitter = EventEmitter;


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module url */



const {getDomain} = __webpack_require__(28);

/**
 * Gets the IDN-decoded hostname from the URL of a frame.
 * If the URL don't have host information (like "about:blank"
 * and "data:" URLs) it falls back to the parent frame.
 *
 * @param {?Frame}  frame
 * @param {URL}    [originUrl]
 * @return {string}
 */
exports.extractHostFromFrame = (frame, originUrl) =>
{
  for (; frame; frame = frame.parent)
  {
    let {hostname} = frame.url;
    if (hostname)
      return hostname;
  }

  return originUrl ? originUrl.hostname : "";
};

function isDomain(hostname)
{
  // No hostname or IPv4 address, also considering hexadecimal octets.
  if (/^((0x[\da-f]+|\d+)(\.|$))*$/i.test(hostname))
    return false;

  // IPv6 address. Since there can't be colons in domains, we can
  // just check whether there are any colons to exclude IPv6 addresses.
  return hostname.indexOf(":") == -1;
}

/**
 * Checks whether the request's origin is different from the document's origin.
 *
 * @param {URL}    url           The request URL
 * @param {string} documentHost  The IDN-decoded hostname of the document
 * @return {Boolean}
 */
exports.isThirdParty = (url, documentHost) =>
{
  let requestHost = url.hostname.replace(/\.+$/, "");
  documentHost = documentHost.replace(/\.+$/, "");

  if (requestHost == documentHost)
    return false;

  if (!isDomain(requestHost) || !isDomain(documentHost))
    return true;

  return getDomain(requestHost) != getDomain(documentHost);
};


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * @fileOverview Matcher class implementing matching addresses against
 *               a list of filters.
 */

const {WhitelistFilter} = __webpack_require__(0);

/**
 * Blacklist/whitelist filter matching
 */
class Matcher
{
  constructor()
  {
    /**
     * Lookup table for filters by their associated keyword
     * @type {Map.<string,(Filter|Filter[])>}
     */
    this.filterByKeyword = new Map();

    /**
     * Lookup table for keywords by the filter
     * @type {Map.<Filter,string>}
     */
    this.keywordByFilter = new Map();
  }

  /**
   * Removes all known filters
   */
  clear()
  {
    this.filterByKeyword.clear();
    this.keywordByFilter.clear();
  }

  /**
   * Adds a filter to the matcher
   * @param {RegExpFilter} filter
   */
  add(filter)
  {
    if (this.keywordByFilter.has(filter))
      return;

    // Look for a suitable keyword
    let keyword = this.findKeyword(filter);
    let oldEntry = this.filterByKeyword.get(keyword);
    if (typeof oldEntry == "undefined")
      this.filterByKeyword.set(keyword, filter);
    else if (oldEntry.length == 1)
      this.filterByKeyword.set(keyword, [oldEntry, filter]);
    else
      oldEntry.push(filter);
    this.keywordByFilter.set(filter, keyword);
  }

  /**
   * Removes a filter from the matcher
   * @param {RegExpFilter} filter
   */
  remove(filter)
  {
    let keyword = this.keywordByFilter.get(filter);
    if (typeof keyword == "undefined")
      return;

    let list = this.filterByKeyword.get(keyword);
    if (list.length <= 1)
      this.filterByKeyword.delete(keyword);
    else
    {
      let index = list.indexOf(filter);
      if (index >= 0)
      {
        list.splice(index, 1);
        if (list.length == 1)
          this.filterByKeyword.set(keyword, list[0]);
      }
    }

    this.keywordByFilter.delete(filter);
  }

  /**
   * Chooses a keyword to be associated with the filter
   * @param {Filter} filter
   * @returns {string} keyword or an empty string if no keyword could be found
   */
  findKeyword(filter)
  {
    let result = "";
    let {pattern} = filter;
    if (pattern == null)
      return result;

    let candidates = pattern.toLowerCase().match(
      /[^a-z0-9%*][a-z0-9%]{3,}(?=[^a-z0-9%*])/g
    );
    if (!candidates)
      return result;

    let hash = this.filterByKeyword;
    let resultCount = 0xFFFFFF;
    let resultLength = 0;
    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let candidate = candidates[i].substr(1);
      let filters = hash.get(candidate);
      let count = typeof filters != "undefined" ? filters.length : 0;
      if (count < resultCount ||
          (count == resultCount && candidate.length > resultLength))
      {
        result = candidate;
        resultCount = count;
        resultLength = candidate.length;
      }
    }
    return result;
  }

  /**
   * Checks whether a particular filter is being matched against.
   * @param {RegExpFilter} filter
   * @returns {boolean}
   */
  hasFilter(filter)
  {
    return this.keywordByFilter.has(filter);
  }

  /**
   * Returns the keyword used for a filter, <code>null</code>
   * for unknown filters.
   * @param {RegExpFilter} filter
   * @returns {?string}
   */
  getKeywordForFilter(filter)
  {
    let keyword = this.keywordByFilter.get(filter);
    return typeof keyword != "undefined" ? keyword : null;
  }

  /**
   * Checks whether the entries for a particular keyword match a URL
   * @param {string} keyword
   * @param {string} location
   * @param {number} typeMask
   * @param {string} [docDomain]
   * @param {boolean} [thirdParty]
   * @param {string} [sitekey]
   * @param {boolean} [specificOnly]
   * @returns {?Filter}
   */
  _checkEntryMatch(keyword, location, typeMask, docDomain, thirdParty, sitekey,
                   specificOnly)
  {
    let list = this.filterByKeyword.get(keyword);
    if (typeof list == "undefined")
      return null;
    for (let i = 0; i < list.length; i++)
    {
      let filter = list[i];

      if (specificOnly && filter.isGeneric() &&
          !(filter instanceof WhitelistFilter))
        continue;

      if (filter.matches(location, typeMask, docDomain, thirdParty, sitekey))
        return filter;
    }
    return null;
  }

  /**
   * Tests whether the URL matches any of the known filters
   * @param {string} location
   *   URL to be tested
   * @param {number} typeMask
   *   bitmask of content / request types to match
   * @param {string} [docDomain]
   *   domain name of the document that loads the URL
   * @param {boolean} [thirdParty]
   *   should be true if the URL is a third-party request
   * @param {string} [sitekey]
   *   public key provided by the document
   * @param {boolean} [specificOnly]
   *   should be <code>true</code> if generic matches should be ignored
   * @returns {?RegExpFilter}
   *   matching filter or <code>null</code>
   */
  matchesAny(location, typeMask, docDomain, thirdParty, sitekey, specificOnly)
  {
    let candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
    if (candidates === null)
      candidates = [];
    candidates.push("");
    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let result = this._checkEntryMatch(candidates[i], location, typeMask,
                                         docDomain, thirdParty, sitekey,
                                         specificOnly);
      if (result)
        return result;
    }

    return null;
  }
}

exports.Matcher = Matcher;

/**
 * Combines a matcher for blocking and exception rules, automatically sorts
 * rules into two {@link Matcher} instances.
 */
class CombinedMatcher
{
  constructor()
  {
    /**
     * Maximal number of matching cache entries to be kept
     * @type {number}
     */
    this.maxCacheEntries = 1000;

    /**
     * Matcher for blocking rules.
     * @type {Matcher}
     */
    this.blacklist = new Matcher();

    /**
     * Matcher for exception rules.
     * @type {Matcher}
     */
    this.whitelist = new Matcher();

    /**
     * Lookup table of previous {@link Matcher#matchesAny} results
     * @type {Map.<string,Filter>}
     */
    this.resultCache = new Map();
  }

  /**
   * @see Matcher#clear
   */
  clear()
  {
    this.blacklist.clear();
    this.whitelist.clear();
    this.resultCache.clear();
  }

  /**
   * @see Matcher#add
   * @param {Filter} filter
   */
  add(filter)
  {
    if (filter instanceof WhitelistFilter)
      this.whitelist.add(filter);
    else
      this.blacklist.add(filter);

    this.resultCache.clear();
  }

  /**
   * @see Matcher#remove
   * @param {Filter} filter
   */
  remove(filter)
  {
    if (filter instanceof WhitelistFilter)
      this.whitelist.remove(filter);
    else
      this.blacklist.remove(filter);

    this.resultCache.clear();
  }

  /**
   * @see Matcher#findKeyword
   * @param {Filter} filter
   * @returns {string} keyword
   */
  findKeyword(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this.whitelist.findKeyword(filter);
    return this.blacklist.findKeyword(filter);
  }

  /**
   * @see Matcher#hasFilter
   * @param {Filter} filter
   * @returns {boolean}
   */
  hasFilter(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this.whitelist.hasFilter(filter);
    return this.blacklist.hasFilter(filter);
  }

  /**
   * @see Matcher#getKeywordForFilter
   * @param {Filter} filter
   * @returns {string} keyword
   */
  getKeywordForFilter(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this.whitelist.getKeywordForFilter(filter);
    return this.blacklist.getKeywordForFilter(filter);
  }

  /**
   * Checks whether a particular filter is slow
   * @param {RegExpFilter} filter
   * @returns {boolean}
   */
  isSlowFilter(filter)
  {
    let matcher = (
      filter instanceof WhitelistFilter ? this.whitelist : this.blacklist
    );
    if (matcher.hasFilter(filter))
      return !matcher.getKeywordForFilter(filter);
    return !matcher.findKeyword(filter);
  }

  /**
   * Optimized filter matching testing both whitelist and blacklist matchers
   * simultaneously. For parameters see
     {@link Matcher#matchesAny Matcher.matchesAny()}.
   * @see Matcher#matchesAny
   * @inheritdoc
   */
  matchesAnyInternal(location, typeMask, docDomain, thirdParty, sitekey,
                     specificOnly)
  {
    let candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
    if (candidates === null)
      candidates = [];
    candidates.push("");

    let blacklistHit = null;
    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let substr = candidates[i];
      let result = this.whitelist._checkEntryMatch(
        substr, location, typeMask, docDomain, thirdParty, sitekey
      );
      if (result)
        return result;
      if (blacklistHit === null)
      {
        blacklistHit = this.blacklist._checkEntryMatch(
          substr, location, typeMask, docDomain, thirdParty, sitekey,
          specificOnly
        );
      }
    }
    return blacklistHit;
  }

  /**
   * @see Matcher#matchesAny
   * @inheritdoc
   */
  matchesAny(location, typeMask, docDomain, thirdParty, sitekey, specificOnly)
  {
    let key = location + " " + typeMask + " " + docDomain + " " + thirdParty +
      " " + sitekey + " " + specificOnly;

    let result = this.resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this.matchesAnyInternal(location, typeMask, docDomain,
                                     thirdParty, sitekey, specificOnly);

    if (this.resultCache.size >= this.maxCacheEntries)
      this.resultCache.clear();

    this.resultCache.set(key, result);

    return result;
  }
}

exports.CombinedMatcher = CombinedMatcher;

/**
 * Shared {@link CombinedMatcher} instance that should usually be used.
 * @type {CombinedMatcher}
 */
let defaultMatcher = new CombinedMatcher();

exports.defaultMatcher = defaultMatcher;


/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module messaging */



const {EventEmitter} = __webpack_require__(7);

/**
 * Communication port wrapping ext.onMessage to receive messages.
 *
 * @constructor
 */
function Port()
{
  this._eventEmitter = new EventEmitter();
  this._onMessage = this._onMessage.bind(this);
  ext.onMessage.addListener(this._onMessage);
}

Port.prototype = {
  _onMessage(message, sender, sendResponse)
  {
    let async = false;
    let callbacks = this._eventEmitter.listeners(message.type);

    for (let callback of callbacks)
    {
      let response = callback(message, sender);

      if (response && typeof response.then == "function")
      {
        response.then(
          sendResponse,
          reason =>
          {
            console.error(reason);
            sendResponse(undefined);
          }
        );
        async = true;
      }
      else if (typeof response != "undefined")
      {
        sendResponse(response);
      }
    }

    return async;
  },

  /**
   * Function to be called when a particular message is received.
   *
   * @callback Port~messageCallback
   * @param {object} message
   * @param {object} sender
   * @return The callback can return undefined (no response),
   *         a value (response to be sent to sender immediately)
   *         or a promise (asynchronous response).
   */

  /**
   * Adds a callback for the specified message.
   *
   * The return value of the callback (if not undefined) is sent as response.
   * @param {string}   name
   * @param {Port~messageCallback} callback
   */
  on(name, callback)
  {
    this._eventEmitter.on(name, callback);
  },

  /**
   * Removes a callback for the specified message.
   *
   * @param {string}   name
   * @param {Port~messageCallback} callback
   */
  off(name, callback)
  {
    this._eventEmitter.off(name, callback);
  },

  /**
   * Disables the port and makes it stop listening to incoming messages.
   */
  disconnect()
  {
    ext.onMessage.removeListener(this._onMessage);
  }
};

/**
 * The default port to receive messages.
 *
 * @type {Port}
 */
exports.port = new Port();

/**
 * Creates a new port that is disconnected when the given window is unloaded.
 *
 * @param {Window} window
 * @return {Port}
 */
exports.getPort = function(window)
{
  let port = new Port();
  window.addEventListener("unload", () =>
  {
    port.disconnect();
  });
  return port;
};



/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



const {filterNotifier} = __webpack_require__(2);
const {FilterStorage} = __webpack_require__(4);
const {DownloadableSubscription, SpecialSubscription} =
  __webpack_require__(5);

const BACKUP_NAME = "file:patterns.ini";

let backupDelay;
let pendingBackup = false;

function setBackupInterval(backupInterval = 60 * 1000)
{
  backupDelay = backupInterval;
}

setBackupInterval();

function scheduleBackup()
{
  if (!pendingBackup)
  {
    pendingBackup = true;

    setTimeout(
      () =>
      {
        saveToStorage();
        pendingBackup = false;
      },
      backupDelay
    );
  }
}

function saveToStorage()
{
  browser.storage.local.set({
    [BACKUP_NAME]: {
      content: serialize(),
      lastModified: Date.now()
    }
  });
}

function serialize()
{
  let buffer = [];

  for (let subscription of FilterStorage.subscriptions)
  {
    if (subscription instanceof SpecialSubscription)
    {
      subscription.serialize(buffer);
      buffer.push("[Subscription filters]");
      subscription.serializeFilters(buffer);
    }
    else if (subscription instanceof DownloadableSubscription)
    {
      let {homepage, title, url, disabled} = subscription;

      buffer.push(
        "[Subscription]",
        `homepage=${homepage}`,
        `title=${title}`,
        `url=${url}`,
        `disabled=${disabled}`
      );
    }
  }
  return buffer;
}

function getBackupData()
{
  return browser.storage.local.get(BACKUP_NAME).then(items =>
  {
    let entry = items[BACKUP_NAME];
    if (entry)
      return entry;

    throw {type: "NoSuchFile"};
  });
}

filterNotifier.on("load", scheduleBackup);
filterNotifier.on("subscription.updated", scheduleBackup);
filterNotifier.on("subscription.added", scheduleBackup);
filterNotifier.on("subscription.removed", scheduleBackup);
filterNotifier.on("subscription.disabled", scheduleBackup);
filterNotifier.on("filter.added", scheduleBackup);
filterNotifier.on("filter.removed", scheduleBackup);
filterNotifier.on("filter.moved", scheduleBackup);
filterNotifier.on("filter.disabled", scheduleBackup);

exports.IndexedDBBackup =
{
  getBackupData,
  // Non-public API, just for tests.
  setBackupInterval
};


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



const keyPrefix = "file:";

function fileToKey(fileName)
{
  return keyPrefix + fileName;
}

function loadFile(fileName)
{
  let key = fileToKey(fileName);
  return browser.storage.local.get(key).then(items =>
  {
    let entry = items[key];
    if (entry)
      return entry;
    throw {type: "NoSuchFile"};
  });
}

function saveFile(fileName, data)
{
  return browser.storage.local.set({
    [fileToKey(fileName)]: {
      content: Array.from(data),
      lastModified: Date.now()
    }
  });
}

exports.IO =
{
  /**
   * Reads text lines from a file.
   * @param {string} fileName
   *    Name of the file to be read
   * @param {TextSink} listener
   *    Function that will be called for each line in the file
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  readFromFile(fileName, listener)
  {
    return loadFile(fileName).then(entry =>
    {
      for (let line of entry.content)
        listener(line);
    });
  },

  /**
   * Writes text lines to a file.
   * @param {string} fileName
   *    Name of the file to be written
   * @param {Iterable.<string>} data
   *    An array-like or iterable object containing the lines (without line
   *    endings)
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  writeToFile(fileName, data)
  {
    return saveFile(fileName, data);
  },

  /**
   * Renames a file.
   * @param {string} fromFile
   *    Name of the file to be renamed
   * @param {string} newName
   *    New file name, will be overwritten if exists
   * @return {Promise}
   *    Promise to be resolved or rejected once the operation is completed
   */
  renameFile(fromFile, newName)
  {
    return loadFile(fromFile)
      .then(entry => browser.storage.local.set({[fileToKey(newName)]: entry}))
      .then(() => browser.storage.local.remove(fileToKey(fromFile)));
  },

  /**
   * Retrieves file metadata.
   * @param {string} fileName
   *    Name of the file to be looked up
   * @return {Promise.<StatData>}
   *    Promise to be resolved with file metadata once the operation is
   *    completed
   */
  statFile(fileName)
  {
    return loadFile(fileName).then(entry =>
    {
      return {
        exists: true,
        lastModified: entry.lastModified
      };
    }).catch(error =>
    {
      if (error.type == "NoSuchFile")
        return {exists: false};
      throw error;
    });
  }
};


/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



function desc(properties)
{
  let descriptor = {};
  let keys = Object.keys(properties);

  for (let key of keys)
    descriptor[key] = Object.getOwnPropertyDescriptor(properties, key);

  return descriptor;
}
exports.desc = desc;

function extend(cls, properties)
{
  return Object.create(cls.prototype, desc(properties));
}
exports.extend = extend;

function findIndex(iterable, callback, thisArg)
{
  let index = 0;
  for (let item of iterable)
  {
    if (callback.call(thisArg, item))
      return index;

    index++;
  }

  return -1;
}
exports.findIndex = findIndex;

function indexOf(iterable, searchElement)
{
  return findIndex(iterable, item => item === searchElement);
}
exports.indexOf = indexOf;


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module subscriptionInit */



const {Subscription,
       DownloadableSubscription,
       SpecialSubscription} =
  __webpack_require__(5);
const {FilterStorage} = __webpack_require__(4);
const {filterNotifier} = __webpack_require__(2);
const info = __webpack_require__(1);
const {Prefs} = __webpack_require__(3);
const {Synchronizer} = __webpack_require__(23);
const {Utils} = __webpack_require__(6);
const {initNotifications} = __webpack_require__(24);
const {updatesVersion} = __webpack_require__(33);

let firstRun;
let subscriptionsCallback = null;
let reinitialized = false;
let dataCorrupted = false;

/**
 * If there aren't any filters, the default subscriptions are added.
 * However, if patterns.ini already did exist and/or any preference
 * is set to a non-default value, this indicates that this isn't the
 * first run, but something went wrong.
 *
 * This function detects the first run, and makes sure that the user
 * gets notified (on the first run page) if the data appears incomplete
 * and therefore will be reinitialized.
 */
function detectFirstRun()
{
  firstRun = FilterStorage.subscriptions.length == 0;

  if (firstRun && (!FilterStorage.firstRun || Prefs.currentVersion))
    reinitialized = true;

  Prefs.currentVersion = info.addonVersion;
}

/**
 * Determines whether to add the default ad blocking subscriptions.
 * Returns true, if there are no filter subscriptions besides those
 * other subscriptions added automatically, and no custom filters.
 *
 * On first run, this logic should always result in true since there
 * is no data and therefore no subscriptions. But it also causes the
 * default ad blocking subscriptions to be added again after some
 * data corruption or misconfiguration.
 *
 * @return {boolean}
 */
function shouldAddDefaultSubscriptions()
{
  for (let subscription of FilterStorage.subscriptions)
  {
    if (subscription instanceof DownloadableSubscription &&
        subscription.url != Prefs.subscriptions_exceptionsurl &&
        subscription.url != Prefs.subscriptions_antiadblockurl &&
        subscription.type != "circumvention")
      return false;

    if (subscription instanceof SpecialSubscription &&
        subscription.filters.length > 0)
      return false;
  }

  return true;
}

/**
 * @typedef {object} DefaultSubscriptions
 * @property {?Element} ads
 * @property {?Element} circumvention
 */
/**
 * Finds the elements for the default ad blocking filter subscriptions based
 * on the user's locale.
 *
 * @param {HTMLCollection} subscriptions
 * @return {DefaultSubscriptions}
 */
function chooseFilterSubscriptions(subscriptions)
{
  let selectedItem = {};
  let selectedPrefix = null;
  let matchCount = 0;
  for (let subscription of subscriptions)
  {
    let prefixes = subscription.getAttribute("prefixes");
    let prefix = prefixes && prefixes.split(",").find(
      lang => new RegExp("^" + lang + "\\b").test(Utils.appLocale)
    );

    let subscriptionType = subscription.getAttribute("type");

    if ((subscriptionType == "ads" || subscriptionType == "circumvention") &&
        !selectedItem[subscriptionType])
      selectedItem[subscriptionType] = subscription;

    if (prefix)
    {
      // The "ads" subscription is the one driving the selection.
      if (subscriptionType == "ads")
      {
        if (!selectedPrefix || selectedPrefix.length < prefix.length)
        {
          selectedItem[subscriptionType] = subscription;
          selectedPrefix = prefix;
          matchCount = 1;
        }
        else if (selectedPrefix && selectedPrefix.length == prefix.length)
        {
          matchCount++;

          // If multiple items have a matching prefix of the same length:
          // Select one of the items randomly, probability should be the same
          // for all items. So we replace the previous match here with
          // probability 1/N (N being the number of matches).
          if (Math.random() * matchCount < 1)
          {
            selectedItem[subscriptionType] = subscription;
            selectedPrefix = prefix;
          }
        }
      }
      else if (subscriptionType == "circumvention")
      {
        selectedItem[subscriptionType] = subscription;
      }
    }
  }
  return selectedItem;
}

function supportsNotificationsWithButtons()
{
  // Older versions of Microsoft Edge (EdgeHTML 16) don't have the
  // notifications API. Newever versions (EdgeHTML 17) seem to crash
  // when it is used.
  // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/20146233/
  if (info.platform == "edgehtml")
    return false;

  // Opera gives an asynchronous error when buttons are provided (we cannot
  // detect that behavior without attempting to show a notification).
  if (info.application == "opera")
    return false;

  // Firefox throws synchronously if the "buttons" option is provided.
  // If buttons are supported (i.e. on Chrome), this fails with
  // an asynchronous error due to missing required options.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1190681
  try
  {
    browser.notifications.create({buttons: []}).catch(() => {});
  }
  catch (e)
  {
    if (e.toString().includes('"buttons" is unsupported'))
      return false;
  }

  return true;
}

/**
 * Gets the filter subscriptions to be added when the extnesion is loaded.
 *
 * @return {Promise|Subscription[]}
 */
function getSubscriptions()
{
  let subscriptions = [];

  // Add pre-configured subscriptions
  for (let url of Prefs.additional_subscriptions)
    subscriptions.push(Subscription.fromURL(url));

  // Add "acceptable ads" and "anti-adblock messages" subscriptions
  if (firstRun)
  {
    let acceptableAdsSubscription = Subscription.fromURL(
      Prefs.subscriptions_exceptionsurl
    );
    acceptableAdsSubscription.title = "Allow non-intrusive advertising";
    subscriptions.push(acceptableAdsSubscription);

    // Only add the anti-adblock messages subscription if
    // the related notification can be shown on this browser.
    if (supportsNotificationsWithButtons())
    {
      let antiAdblockSubscription = Subscription.fromURL(
        Prefs.subscriptions_antiadblockurl
      );
      antiAdblockSubscription.disabled = true;
      subscriptions.push(antiAdblockSubscription);
    }
  }

  // Add default ad blocking subscriptions (e.g. EasyList, Anti-Circumvention)
  let addDefaultSubscription = shouldAddDefaultSubscriptions();
  if (addDefaultSubscription || !Prefs.subscriptions_addedanticv)
  {
    return fetch("subscriptions.xml")
      .then(response => response.text())
      .then(text =>
      {
        let doc = new DOMParser().parseFromString(text, "application/xml");
        let nodes = doc.getElementsByTagName("subscription");

        let defaultSubscriptions = chooseFilterSubscriptions(nodes);
        if (defaultSubscriptions)
        {
          for (let name in defaultSubscriptions)
          {
            let node = defaultSubscriptions[name];
            if (!node)
              continue;

            let url = node.getAttribute("url");
            if (url)
            {
              // Make sure that we don't add Easylist again if we want
              // to just add the Anti-Circumvention subscription.
              let type = node.getAttribute("type");
              if (!addDefaultSubscription && type != "circumvention")
                continue;

              let subscription = Subscription.fromURL(url);
              subscription.disabled = false;
              subscription.title = node.getAttribute("title");
              subscription.homepage = node.getAttribute("homepage");
              subscription.type = type;
              subscriptions.push(subscription);
              if (subscription.type == "circumvention")
                Prefs.subscriptions_addedanticv = true;
            }
          }
        }

        return subscriptions;
      });
  }

  return subscriptions;
}

function addSubscriptionsAndNotifyUser(subscriptions)
{
  if (subscriptionsCallback)
    subscriptions = subscriptionsCallback(subscriptions);

  for (let subscription of subscriptions)
  {
    FilterStorage.addSubscription(subscription);
    if (subscription instanceof DownloadableSubscription &&
        !subscription.lastDownload)
      Synchronizer.execute(subscription);
  }

  // Show first run page or the updates page. The latter is only shown
  // on Chromium (since the current updates page announces features that
  // aren't new to Firefox users), and only if this version of the
  // updates page hasn't been shown yet.
  if (firstRun || info.platform == "chromium" &&
                  updatesVersion > Prefs.last_updates_page_displayed)
  {
    return Prefs.set("last_updates_page_displayed", updatesVersion).catch(() =>
    {
      dataCorrupted = true;
    }).then(() =>
    {
      if (!Prefs.suppress_first_run_page)
      {
        // Always show the first run page if a data corruption was detected
        // (either through failure of reading from or writing to storage.local).
        // The first run page notifies the user about the data corruption.
        let url;
        if (firstRun || dataCorrupted)
          url = "first-run.html";
        else
          url = "updates.html";
        browser.tabs.create({url});
      }
    });
  }
}

Promise.all([
  filterNotifier.once("load"),
  Prefs.untilLoaded.catch(() => { dataCorrupted = true; })
]).then(detectFirstRun)
  .then(getSubscriptions)
  .then(addSubscriptionsAndNotifyUser)
  // We have to require the "uninstall" module on demand,
  // as the "uninstall" module in turn requires this module.
  .then(() => { __webpack_require__(34).setUninstallURL(); })
  .then(initNotifications);

/**
 * Gets a value indicating whether the default filter subscriptions have been
 * added again because there weren't any subscriptions even though this wasn't
 * the first run.
 *
 * @return {boolean}
 */
exports.isReinitialized = () => reinitialized;

/**
 * Gets a value indicating whether a data corruption was detected.
 *
 * @return {boolean}
 */
exports.isDataCorrupted = () => dataCorrupted;

/**
 * Sets a callback that is called with an array of subscriptions to be added
 * during initialization. The callback must return an array of subscriptions
 * that will effectively be added.
 *
 * @param {function} callback
 */
exports.setSubscriptionsCallback = callback =>
{
  subscriptionsCallback = callback;
};

// Exports for tests only
exports.chooseFilterSubscriptions = chooseFilterSubscriptions;


/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * @fileOverview Downloads a set of URLs in regular time intervals.
 */

const {Utils} = __webpack_require__(6);

const MILLIS_IN_SECOND = exports.MILLIS_IN_SECOND = 1000;
const MILLIS_IN_MINUTE = exports.MILLIS_IN_MINUTE = 60 * MILLIS_IN_SECOND;
const MILLIS_IN_HOUR = exports.MILLIS_IN_HOUR = 60 * MILLIS_IN_MINUTE;
const MILLIS_IN_DAY = exports.MILLIS_IN_DAY = 24 * MILLIS_IN_HOUR;

class Downloader
{
  /**
   * Creates a new downloader instance.
   * @param {function} dataSource
   *   Function that will yield downloadable objects on each check
   * @param {number} initialDelay
   *   Number of milliseconds to wait before the first check
   * @param {number} checkInterval
   *   Interval between the checks
   */
  constructor(dataSource, initialDelay, checkInterval)
  {
    /**
     * Maximal time interval that the checks can be left out until the soft
     * expiration interval increases.
     * @type {number}
     */
    this.maxAbsenceInterval = 1 * MILLIS_IN_DAY;

    /**
     * Minimal time interval before retrying a download after an error.
     * @type {number}
     */
    this.minRetryInterval = 1 * MILLIS_IN_DAY;

    /**
     * Maximal allowed expiration interval; larger expiration intervals will be
     * corrected.
     * @type {number}
     */
    this.maxExpirationInterval = 14 * MILLIS_IN_DAY;

    /**
     * Maximal number of redirects before the download is considered as failed.
     * @type {number}
     */
    this.maxRedirects = 5;

    /**
     * Called whenever expiration intervals for an object need to be adapted.
     * @type {function?}
     */
    this.onExpirationChange = null;

    /**
     * Callback to be triggered whenever a download starts.
     * @type {function?}
     */
    this.onDownloadStarted = null;

    /**
     * Callback to be triggered whenever a download finishes successfully. The
     * callback can return an error code to indicate that the data is wrong.
     * @type {function?}
     */
    this.onDownloadSuccess = null;

    /**
     * Callback to be triggered whenever a download fails.
     * @type {function?}
     */
    this.onDownloadError = null;

    /**
     * Function that will yield downloadable objects on each check.
     * @type {function}
     */
    this.dataSource = dataSource;

    /**
     * Timer triggering the downloads.
     * @type {nsITimer}
     */
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._timer.initWithCallback(() =>
    {
      this._timer.delay = checkInterval;
      this._doCheck();
    }, initialDelay, Ci.nsITimer.TYPE_REPEATING_SLACK);

    /**
     * Set containing the URLs of objects currently being downloaded.
     * @type {Set.<string>}
     */
    this._downloading = new Set();
  }

  /**
   * Checks whether anything needs downloading.
   */
  _doCheck()
  {
    let now = Date.now();
    for (let downloadable of this.dataSource())
    {
      if (downloadable.lastCheck &&
          now - downloadable.lastCheck > this.maxAbsenceInterval)
      {
        // No checks for a long time interval - user must have been offline,
        // e.g.  during a weekend. Increase soft expiration to prevent load
        // peaks on the server.
        downloadable.softExpiration += now - downloadable.lastCheck;
      }
      downloadable.lastCheck = now;

      // Sanity check: do expiration times make sense? Make sure people changing
      // system clock don't get stuck with outdated subscriptions.
      if (downloadable.hardExpiration - now > this.maxExpirationInterval)
        downloadable.hardExpiration = now + this.maxExpirationInterval;
      if (downloadable.softExpiration - now > this.maxExpirationInterval)
        downloadable.softExpiration = now + this.maxExpirationInterval;

      // Notify the caller about changes to expiration parameters
      if (this.onExpirationChange)
        this.onExpirationChange(downloadable);

      // Does that object need downloading?
      if (downloadable.softExpiration > now &&
          downloadable.hardExpiration > now)
      {
        continue;
      }

      // Do not retry downloads too often
      if (downloadable.lastError &&
          now - downloadable.lastError < this.minRetryInterval)
      {
        continue;
      }

      this._download(downloadable, 0);
    }
  }

  /**
   * Stops the periodic checks.
   */
  cancel()
  {
    this._timer.cancel();
  }

  /**
   * Checks whether an address is currently being downloaded.
   * @param {string} url
   * @returns {boolean}
   */
  isDownloading(url)
  {
    return this._downloading.has(url);
  }

  /**
   * Starts downloading for an object.
   * @param {Downloadable} downloadable
   */
  download(downloadable)
  {
    // Make sure to detach download from the current execution context
    Utils.runAsync(this._download.bind(this, downloadable, 0));
  }

  /**
   * Generates the real download URL for an object by appending various
   * parameters.
   * @param {Downloadable} downloadable
   * @returns {string}
   */
  getDownloadUrl(downloadable)
  {
    const {addonName, addonVersion, application, applicationVersion,
           platform, platformVersion} = __webpack_require__(1);
    let url = downloadable.redirectURL || downloadable.url;
    if (url.includes("?"))
      url += "&";
    else
      url += "?";
    // We limit the download count to 4+ to keep the request anonymized
    let {downloadCount} = downloadable;
    if (downloadCount > 4)
      downloadCount = "4+";
    url += "addonName=" + encodeURIComponent(addonName) +
        "&addonVersion=" + encodeURIComponent(addonVersion) +
        "&application=" + encodeURIComponent(application) +
        "&applicationVersion=" + encodeURIComponent(applicationVersion) +
        "&platform=" + encodeURIComponent(platform) +
        "&platformVersion=" + encodeURIComponent(platformVersion) +
        "&lastVersion=" + encodeURIComponent(downloadable.lastVersion) +
        "&downloadCount=" + encodeURIComponent(downloadCount);
    return url;
  }

  _download(downloadable, redirects)
  {
    if (this.isDownloading(downloadable.url))
      return;

    let downloadUrl = this.getDownloadUrl(downloadable);
    let request = null;

    let errorCallback = function errorCallback(error)
    {
      let channelStatus = -1;
      try
      {
        channelStatus = request.channel.status;
      }
      catch (e) {}

      let responseStatus = request.status;

      Cu.reportError("Adblock Plus: Downloading URL " + downloadable.url +
                     " failed (" + error + ")\n" +
                     "Download address: " + downloadUrl + "\n" +
                     "Channel status: " + channelStatus + "\n" +
                     "Server response: " + responseStatus);

      if (this.onDownloadError)
      {
        // Allow one extra redirect if the error handler gives us a redirect URL
        let redirectCallback = null;
        if (redirects <= this.maxRedirects)
        {
          redirectCallback = url =>
          {
            downloadable.redirectURL = url;
            this._download(downloadable, redirects + 1);
          };
        }

        this.onDownloadError(downloadable, downloadUrl, error, channelStatus,
                             responseStatus, redirectCallback);
      }
    }.bind(this);

    try
    {
      request = new XMLHttpRequest();
      request.mozBackgroundRequest = true;
      request.open("GET", downloadUrl);
    }
    catch (e)
    {
      errorCallback("synchronize_invalid_url");
      return;
    }

    try
    {
      request.overrideMimeType("text/plain");
      request.channel.loadFlags = request.channel.loadFlags |
                                  request.channel.INHIBIT_CACHING |
                                  request.channel.VALIDATE_ALWAYS;

      // Override redirect limit from preferences, user might have set it to 1
      if (request.channel instanceof Ci.nsIHttpChannel)
        request.channel.redirectionLimit = this.maxRedirects;
    }
    catch (e)
    {
      Cu.reportError(e);
    }

    request.addEventListener("error", event =>
    {
      if (onShutdown.done)
        return;

      this._downloading.delete(downloadable.url);
      errorCallback("synchronize_connection_error");
    }, false);

    request.addEventListener("load", event =>
    {
      if (onShutdown.done)
        return;

      this._downloading.delete(downloadable.url);

      // Status will be 0 for non-HTTP requests
      if (request.status && request.status != 200)
      {
        errorCallback("synchronize_connection_error");
        return;
      }

      downloadable.downloadCount++;

      this.onDownloadSuccess(
        downloadable, request.responseText, errorCallback,
        url =>
        {
          if (redirects >= this.maxRedirects)
            errorCallback("synchronize_connection_error");
          else
          {
            downloadable.redirectURL = url;
            this._download(downloadable, redirects + 1);
          }
        }
      );
    });

    request.send(null);

    this._downloading.add(downloadable.url);
    if (this.onDownloadStarted)
      this.onDownloadStarted(downloadable);
  }

  /**
   * Produces a soft and a hard expiration interval for a given supplied
   * expiration interval.
   * @param {number} interval
   * @returns {Array.<number>} soft and hard expiration interval
   */
  processExpirationInterval(interval)
  {
    interval = Math.min(Math.max(interval, 0), this.maxExpirationInterval);
    let soft = Math.round(interval * (Math.random() * 0.4 + 0.8));
    let hard = interval * 2;
    let now = Date.now();
    return [now + soft, now + hard];
  }
}

exports.Downloader = Downloader;

class Downloadable
{
  /**
   * Creates an object that can be downloaded by the downloader.
   * @param {string} url  URL that has to be requested for the object
   */
  constructor(url)
  {
    /**
     * URL that the download was redirected to if any.
     * @type {string?}
     */
    this.redirectURL = null;

    /**
     * Time of last download error or 0 if the last download was successful.
     * @type {number}
     */
    this.lastError = 0;

    /**
     * Time of last check whether the object needs downloading.
     * @type {number}
     */
    this.lastCheck = 0;

    /**
     * Object version corresponding to the last successful download.
     * @type {number}
     */
    this.lastVersion = 0;

    /**
     * Soft expiration interval; will increase if no checks are performed for a
     * while.
     * @type {number}
     */
    this.softExpiration = 0;

    /**
     * Hard expiration interval; this is fixed.
     * @type {number}
     */
    this.hardExpiration = 0;

    /**
     * Number indicating how often the object was downloaded.
     * @type {number}
     */
    this.downloadCount = 0;

    /**
     * URL that has to be requested for the object.
     * @type {string}
     */
    this.url = url;
  }
}

exports.Downloadable = Downloadable;


/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * @fileOverview Handles notifications.
 */

const {Prefs} = __webpack_require__(3);
const {Downloader, Downloadable,
       MILLIS_IN_MINUTE, MILLIS_IN_HOUR,
       MILLIS_IN_DAY} = __webpack_require__(15);
const {Utils} = __webpack_require__(6);
const {Matcher, defaultMatcher} = __webpack_require__(9);
const {Filter, RegExpFilter, WhitelistFilter} = __webpack_require__(0);

const INITIAL_DELAY = 1 * MILLIS_IN_MINUTE;
const CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
const EXPIRATION_INTERVAL = 1 * MILLIS_IN_DAY;
const TYPE = {
  information: 0,
  question: 1,
  relentless: 2,
  critical: 3
};

let showListeners = [];
let questionListeners = {};

function getNumericalSeverity(notification)
{
  if (notification.type in TYPE)
    return TYPE[notification.type];
  return TYPE.information;
}

function saveNotificationData()
{
  // HACK: JSON values aren't saved unless they are assigned a different object.
  Prefs.notificationdata = JSON.parse(JSON.stringify(Prefs.notificationdata));
}

function localize(translations, locale)
{
  if (locale in translations)
    return translations[locale];

  let languagePart = locale.substring(0, locale.indexOf("-"));
  if (languagePart && languagePart in translations)
    return translations[languagePart];

  let defaultLocale = "en-US";
  return translations[defaultLocale];
}

function parseVersionComponent(comp)
{
  if (comp == "*")
    return Infinity;
  return parseInt(comp, 10) || 0;
}

function compareVersion(v1, v2)
{
  let regexp = /^(.*?)([a-z].*)?$/i;
  let [, head1, tail1] = regexp.exec(v1);
  let [, head2, tail2] = regexp.exec(v2);
  let components1 = head1.split(".");
  let components2 = head2.split(".");

  for (let i = 0; i < components1.length ||
                  i < components2.length; i++)
  {
    let result = parseVersionComponent(components1[i]) -
                 parseVersionComponent(components2[i]) || 0;

    if (result != 0)
      return result;
  }

  // Compare version suffix (e.g. 0.1alpha < 0.1b1 < 01.b2 < 0.1).
  // However, note that this is a simple string comparision, meaning: b10 < b2
  if (tail1 == tail2)
    return 0;
  if (!tail1 || tail2 && tail1 > tail2)
    return 1;
  return -1;
}

/**
 * The object providing actual downloading functionality.
 * @type {Downloader}
 */
let downloader = null;
let localData = [];

/**
 * Regularly fetches notifications and decides which to show.
 * @class
 */
let Notification = exports.Notification =
{
  /**
   * Called on module startup.
   */
  init()
  {
    downloader = new Downloader(this._getDownloadables.bind(this),
                                INITIAL_DELAY, CHECK_INTERVAL);
    downloader.onExpirationChange = this._onExpirationChange.bind(this);
    downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    downloader.onDownloadError = this._onDownloadError.bind(this);
    onShutdown.add(() => downloader.cancel());
  },

  /**
   * Yields a Downloadable instances for the notifications download.
   */
  *_getDownloadables()
  {
    let downloadable = new Downloadable(Prefs.notificationurl);
    if (typeof Prefs.notificationdata.lastError === "number")
      downloadable.lastError = Prefs.notificationdata.lastError;
    if (typeof Prefs.notificationdata.lastCheck === "number")
      downloadable.lastCheck = Prefs.notificationdata.lastCheck;
    if (typeof Prefs.notificationdata.data === "object" &&
        "version" in Prefs.notificationdata.data)
    {
      downloadable.lastVersion = Prefs.notificationdata.data.version;
    }
    if (typeof Prefs.notificationdata.softExpiration === "number")
      downloadable.softExpiration = Prefs.notificationdata.softExpiration;
    if (typeof Prefs.notificationdata.hardExpiration === "number")
      downloadable.hardExpiration = Prefs.notificationdata.hardExpiration;
    if (typeof Prefs.notificationdata.downloadCount === "number")
      downloadable.downloadCount = Prefs.notificationdata.downloadCount;
    yield downloadable;
  },

  _onExpirationChange(downloadable)
  {
    Prefs.notificationdata.lastCheck = downloadable.lastCheck;
    Prefs.notificationdata.softExpiration = downloadable.softExpiration;
    Prefs.notificationdata.hardExpiration = downloadable.hardExpiration;
    saveNotificationData();
  },

  _onDownloadSuccess(downloadable, responseText, errorCallback,
                     redirectCallback)
  {
    try
    {
      let data = JSON.parse(responseText);
      for (let notification of data.notifications)
      {
        if ("severity" in notification)
        {
          if (!("type" in notification))
            notification.type = notification.severity;
          delete notification.severity;
        }
      }
      Prefs.notificationdata.data = data;
    }
    catch (e)
    {
      Cu.reportError(e);
      errorCallback("synchronize_invalid_data");
      return;
    }

    Prefs.notificationdata.lastError = 0;
    Prefs.notificationdata.downloadStatus = "synchronize_ok";
    [
      Prefs.notificationdata.softExpiration,
      Prefs.notificationdata.hardExpiration
    ] = downloader.processExpirationInterval(EXPIRATION_INTERVAL);
    Prefs.notificationdata.downloadCount = downloadable.downloadCount;
    saveNotificationData();

    Notification.showNext();
  },

  _onDownloadError(downloadable, downloadURL, error, channelStatus,
                   responseStatus, redirectCallback)
  {
    Prefs.notificationdata.lastError = Date.now();
    Prefs.notificationdata.downloadStatus = error;
    saveNotificationData();
  },

  /**
   * Adds a listener for notifications to be shown.
   * @param {Function} listener Listener to be invoked when a notification is
   *                   to be shown
   */
  addShowListener(listener)
  {
    if (showListeners.indexOf(listener) == -1)
      showListeners.push(listener);
  },

  /**
   * Removes the supplied listener.
   * @param {Function} listener Listener that was added via addShowListener()
   */
  removeShowListener(listener)
  {
    let index = showListeners.indexOf(listener);
    if (index != -1)
      showListeners.splice(index, 1);
  },

  /**
   * Determines which notification is to be shown next.
   * @param {string} url URL to match notifications to (optional)
   * @return {Object} notification to be shown, or null if there is none
   */
  _getNextToShow(url)
  {
    let remoteData = [];
    if (typeof Prefs.notificationdata.data == "object" &&
        Prefs.notificationdata.data.notifications instanceof Array)
    {
      remoteData = Prefs.notificationdata.data.notifications;
    }

    let notifications = localData.concat(remoteData);
    if (notifications.length === 0)
      return null;

    const {addonName, addonVersion, application,
           applicationVersion, platform, platformVersion} = __webpack_require__(1);

    let targetChecks = {
      extension: v => v == addonName,
      extensionMinVersion:
        v => compareVersion(addonVersion, v) >= 0,
      extensionMaxVersion:
        v => compareVersion(addonVersion, v) <= 0,
      application: v => v == application,
      applicationMinVersion:
        v => compareVersion(applicationVersion, v) >= 0,
      applicationMaxVersion:
        v => compareVersion(applicationVersion, v) <= 0,
      platform: v => v == platform,
      platformMinVersion:
        v => compareVersion(platformVersion, v) >= 0,
      platformMaxVersion:
        v => compareVersion(platformVersion, v) <= 0,
      blockedTotalMin: v => Prefs.show_statsinpopup &&
        Prefs.blocked_total >= v,
      blockedTotalMax: v => Prefs.show_statsinpopup &&
        Prefs.blocked_total <= v,
      locales: v => v.includes(Utils.appLocale)
    };

    let notificationToShow = null;
    for (let notification of notifications)
    {
      if (typeof notification.type === "undefined" ||
          notification.type !== "critical")
      {
        let shown;
        if (typeof Prefs.notificationdata.shown == "object")
          shown = Prefs.notificationdata.shown[notification.id];

        if (typeof shown != "undefined")
        {
          if (typeof notification.interval == "number")
          {
            if (shown + notification.interval > Date.now())
              continue;
          }
          else if (shown)
            continue;
        }

        if (notification.type !== "relentless" &&
            Prefs.notifications_ignoredcategories.indexOf("*") != -1)
        {
          continue;
        }
      }

      if (typeof url === "string" || notification.urlFilters instanceof Array)
      {
        if (Prefs.enabled && typeof url === "string" &&
            notification.urlFilters instanceof Array)
        {
          let host;
          try
          {
            host = new URL(url).hostname;
          }
          catch (e)
          {
            host = "";
          }

          let exception = defaultMatcher.matchesAny(
            url, RegExpFilter.typeMap.DOCUMENT, host, false, null
          );
          if (exception instanceof WhitelistFilter)
            continue;

          let matcher = new Matcher();
          for (let urlFilter of notification.urlFilters)
            matcher.add(Filter.fromText(urlFilter));
          if (!matcher.matchesAny(url, RegExpFilter.typeMap.DOCUMENT, host,
              false, null))
          {
            continue;
          }
        }
        else
          continue;
      }

      if (notification.targets instanceof Array)
      {
        let match = false;

        for (let target of notification.targets)
        {
          if (Object.keys(target).every(key =>
              targetChecks.hasOwnProperty(key) &&
              targetChecks[key](target[key])))
          {
            match = true;
            break;
          }
        }
        if (!match)
        {
          continue;
        }
      }

      if (!notificationToShow ||
          getNumericalSeverity(notification) >
            getNumericalSeverity(notificationToShow))
        notificationToShow = notification;
    }

    return notificationToShow;
  },

  /**
   * Invokes the listeners added via addShowListener() with the next
   * notification to be shown.
   * @param {string} url URL to match notifications to (optional)
   */
  showNext(url)
  {
    let notification = Notification._getNextToShow(url);
    if (notification)
    {
      for (let showListener of showListeners)
        showListener(notification);
    }
  },

  /**
   * Marks a notification as shown.
   * @param {string} id ID of the notification to be marked as shown
   */
  markAsShown(id)
  {
    let now = Date.now();
    let data = Prefs.notificationdata;

    if (data.shown instanceof Array)
    {
      let newShown = {};
      for (let oldId of data.shown)
        newShown[oldId] = now;
      data.shown = newShown;
    }

    if (typeof data.shown != "object")
      data.shown = {};

    data.shown[id] = now;

    saveNotificationData();
  },

  /**
   * Localizes the texts of the supplied notification.
   * @param {Object} notification notification to translate
   * @return {Object} the translated texts
   */
  getLocalizedTexts(notification)
  {
    let textKeys = ["title", "message"];
    let localizedTexts = {};
    for (let key of textKeys)
    {
      if (key in notification)
      {
        if (typeof notification[key] == "string")
          localizedTexts[key] = notification[key];
        else
          localizedTexts[key] = localize(notification[key], Utils.appLocale);
      }
    }
    return localizedTexts;
  },

  /**
   * Adds a local notification.
   * @param {Object} notification notification to add
   */
  addNotification(notification)
  {
    if (localData.indexOf(notification) == -1)
      localData.push(notification);
  },

  /**
   * Removes an existing local notification.
   * @param {Object} notification notification to remove
   */
  removeNotification(notification)
  {
    let index = localData.indexOf(notification);
    if (index > -1)
      localData.splice(index, 1);
  },

  /**
   * A callback function which listens to see if notifications were approved.
   *
   * @callback QuestionListener
   * @param {boolean} approved
   */

  /**
   * Adds a listener for question-type notifications
   * @param {string} id
   * @param {QuestionListener} listener
   */
  addQuestionListener(id, listener)
  {
    if (!(id in questionListeners))
      questionListeners[id] = [];
    if (questionListeners[id].indexOf(listener) === -1)
      questionListeners[id].push(listener);
  },

  /**
   * Removes a listener that was previously added via addQuestionListener
   * @param {string} id
   * @param {QuestionListener} listener
   */
  removeQuestionListener(id, listener)
  {
    if (!(id in questionListeners))
      return;
    let index = questionListeners[id].indexOf(listener);
    if (index > -1)
      questionListeners[id].splice(index, 1);
    if (questionListeners[id].length === 0)
      delete questionListeners[id];
  },

  /**
   * Notifies question listeners about interactions with a notification
   * @param {string} id notification ID
   * @param {boolean} approved indicator whether notification has been approved
   */
  triggerQuestionListeners(id, approved)
  {
    if (!(id in questionListeners))
      return;
    let listeners = questionListeners[id];
    for (let listener of listeners)
      listener(approved);
  },

  /**
   * Toggles whether notifications of a specific category should be ignored
   * @param {string} category notification category identifier
   * @param {boolean} [forceValue] force specified value
   */
  toggleIgnoreCategory(category, forceValue)
  {
    let categories = Prefs.notifications_ignoredcategories;
    let index = categories.indexOf(category);
    if (index == -1 && forceValue !== false)
    {
      categories.push(category);
      Prefs.notifications_showui = true;
    }
    else if (index != -1 && forceValue !== true)
      categories.splice(index, 1);

    // HACK: JSON values aren't saved unless they are assigned a
    // different object.
    Prefs.notifications_ignoredcategories =
      JSON.parse(JSON.stringify(categories));
  }
};
Notification.init();


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module whitelisting */



const {defaultMatcher} = __webpack_require__(9);
const {Filter, RegExpFilter} = __webpack_require__(0);
const {filterNotifier} = __webpack_require__(2);
const {FilterStorage} = __webpack_require__(4);
const {extractHostFromFrame, isThirdParty} = __webpack_require__(8);
const {port} = __webpack_require__(10);
const {logWhitelistedDocument} = __webpack_require__(29);
const {verifySignature} = __webpack_require__(30);

let sitekeys = new ext.PageMap();

function match(page, url, typeMask, docDomain, sitekey)
{
  let thirdParty = !!docDomain && isThirdParty(url, docDomain);

  if (!docDomain)
    docDomain = url.hostname;

  let filter = defaultMatcher.whitelist.matchesAny(
    url.href, typeMask, docDomain, thirdParty, sitekey
  );

  if (filter && page)
    logWhitelistedDocument(page.id, url.href, typeMask, docDomain, filter);

  return filter;
}

let checkWhitelisted =
/**
 * Gets the active whitelisting filter for the document associated
 * with the given page/frame, or null if it's not whitelisted.
 *
 * @param {?Page}   page
 * @param {?Frame} [frame]
 * @param {?URL}   [originUrl]
 * @param {number} [typeMask=RegExpFilter.typeMap.DOCUMENT]
 * @return {?WhitelistFilter}
 */
exports.checkWhitelisted = (page, frame, originUrl,
                            typeMask = RegExpFilter.typeMap.DOCUMENT) =>
{
  if (frame || originUrl)
  {
    while (frame)
    {
      let parentFrame = frame.parent;
      let filter = match(page, frame.url, typeMask,
                         extractHostFromFrame(parentFrame, originUrl),
                         getKey(page, frame, originUrl));

      if (filter)
        return filter;

      frame = parentFrame;
    }

    return originUrl && match(page, originUrl, typeMask, null,
                              getKey(null, null, originUrl));
  }

  return page && match(page, page.url, typeMask);
};

port.on("filters.isWhitelisted", message =>
{
  return !!checkWhitelisted(new ext.Page(message.tab));
});

port.on("filters.whitelist", message =>
{
  let page = new ext.Page(message.tab);
  let host = page.url.hostname.replace(/^www\./, "");
  let filter = Filter.fromText("@@||" + host + "^$document");
  if (filter.subscriptionCount && filter.disabled)
  {
    filter.disabled = false;
  }
  else
  {
    filter.disabled = false;
    FilterStorage.addFilter(filter);
  }
});

port.on("filters.unwhitelist", message =>
{
  let page = new ext.Page(message.tab);
  // Remove any exception rules applying to this URL
  let filter = checkWhitelisted(page);
  while (filter)
  {
    FilterStorage.removeFilter(filter);
    if (filter.subscriptionCount)
      filter.disabled = true;
    filter = checkWhitelisted(page);
  }
});

function revalidateWhitelistingState(page)
{
  filterNotifier.emit(
    "page.WhitelistingStateRevalidate",
    page, checkWhitelisted(page)
  );
}

filterNotifier.on("filter.behaviorChanged", () =>
{
  browser.tabs.query({}, tabs =>
  {
    for (let tab of tabs)
      revalidateWhitelistingState(new ext.Page(tab));
  });
});

ext.pages.onLoading.addListener(revalidateWhitelistingState);

let getKey =
/**
 * Gets the public key, previously recorded for the given page
 * and frame, to be considered for the $sitekey filter option.
 *
 * @param {?Page}   page
 * @param {?Frame}  frame
 * @param {URL}    [originUrl]
 * @return {string}
 */
exports.getKey = (page, frame, originUrl) =>
{
  if (page)
  {
    let keys = sitekeys.get(page);
    if (keys)
    {
      for (; frame; frame = frame.parent)
      {
        let key = keys.get(frame.url.href);
        if (key)
          return key;
      }
    }
  }

  if (originUrl)
  {
    for (let keys of sitekeys._map.values())
    {
      let key = keys.get(originUrl.href);
      if (key)
        return key;
    }
  }

  return null;
};

function checkKey(token, url)
{
  let parts = token.split("_");
  if (parts.length < 2)
    return false;

  let key = parts[0].replace(/=/g, "");
  let signature = parts[1];
  let data = url.pathname + url.search + "\0" +
             url.host + "\0" +
             window.navigator.userAgent;
  if (!verifySignature(key, signature, data))
    return false;

  return key;
}

function recordKey(key, page, url)
{
  let keys = sitekeys.get(page);
  if (!keys)
  {
    keys = new Map();
    sitekeys.set(page, keys);
  }
  keys.set(url.href, key);
}

port.on("filters.addKey", (message, sender) =>
{
  let key = checkKey(message.token, sender.frame.url);
  if (key)
    recordKey(key, sender.page, sender.frame.url);
});

function onHeadersReceived(details)
{
  let page = new ext.Page({id: details.tabId});

  for (let header of details.responseHeaders)
  {
    if (header.name.toLowerCase() == "x-adblock-key" && header.value)
    {
      let url = new URL(details.url);
      let key = checkKey(header.value, url);
      if (key)
      {
        recordKey(key, page, url);
        break;
      }
    }
  }
}

if (typeof browser == "object")
{
  browser.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    {
      urls: ["http://*/*", "https://*/*"],
      types: ["main_frame", "sub_frame"]
    },
    ["responseHeaders"]
  );
}


/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(19);
__webpack_require__(22);
__webpack_require__(35);
__webpack_require__(36);
__webpack_require__(38);
__webpack_require__(40);
module.exports = __webpack_require__(41);


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


{
  const {IndexedDBBackup} = __webpack_require__(11);
  const info = __webpack_require__(1);
  const {FilterStorage} = __webpack_require__(4);
  const {Filter} = __webpack_require__(0);
  const {Subscription, SpecialSubscription} =
    __webpack_require__(5);

  let backupDelay = 100;
  let subscription = Subscription.fromObject({
    title: "test",
    url: "test.com",
    homepage: "example.com",
    lastSuccess: 8,
    disabled: false,
    lastDownload: 12,
    lastCheck: 16,
    softExpiration: 18,
    expires: 20,
    downloadStatus: "done",
    errors: 3,
    version: 24,
    downloadCount: 1,
    requiredVersion: "0.6"
  });
  let filter = Filter.fromText("example.com");
  let specialSubscription = SpecialSubscription.createForFilter(filter);

  let testEdge = info.platform == "edgehtml" ? QUnit.test : QUnit.skip;

  QUnit.module("Microsoft Edge indexedDB backup", {
    beforeEach()
    {
      this._storageLocalSet = browser.storage.local.set;
      IndexedDBBackup.setBackupInterval(backupDelay);
    },
    afterEach()
    {
      Object.defineProperty(
        browser.storage.local, "set",
        {value: this._storageLocalSet, enumerable: true}
      );
      IndexedDBBackup.setBackupInterval();
    }
  });

  testEdge("Backup creation", assert =>
  {
    testSaveSteps(assert);
  });

  function testSaveSteps(assert)
  {
    let start = performance.now();
    let saveTimes = [];

    let steps = [
      {
        done: assert.async(),
        check(data)
        {
          let expectedFormat = [
            "[Subscription]",
            `url=${specialSubscription.url}`,
            "defaults=blocking",
            "[Subscription filters]",
            "example.com",
            "[Subscription]",
            "homepage=example.com",
            "title=test",
            "url=test.com",
            "disabled=false"
          ];

          ok(
            saveTimes[0] - start >= backupDelay,
            "first write is deferred"
          );
          deepEqual(
            data.content,
            expectedFormat,
            "saved data has the correct information"
          );

          FilterStorage.removeSubscription(subscription);
          FilterStorage.removeSubscription(specialSubscription);
        }
      },
      {
        done: assert.async(),
        check(data)
        {
          ok(
            saveTimes[1] - saveTimes[0] >= backupDelay,
            "next changes are saved after the write delay"
          );
          deepEqual(
            data.content, [], "saved data has the correct information"
          );
        }
      }
    ];
    let mockSave = data =>
    {
      let step = steps.shift();

      saveTimes.push(performance.now());

      setTimeout(() =>
      {
        step.check(data["file:patterns.ini"]);
        step.done();
      }, 0);
    };

    Object.defineProperty(
      browser.storage.local, "set",
      {value: mockSave, enumerable: true}
    );

    FilterStorage.addSubscription(specialSubscription);
    FilterStorage.addSubscription(subscription);
  }
}


/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * Converts raw text into a regular expression string
 * @param {string} text the string to convert
 * @return {string} regular expression representation of the text
 */
function textToRegExp(text)
{
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

exports.textToRegExp = textToRegExp;

/**
 * Converts filter text into regular expression string
 * @param {string} text as in Filter()
 * @param {boolean} [captureAll=false] whether to enable the capturing of
 *   leading and trailing wildcards in the filter text; by default, leading and
 *   trailing wildcards are stripped out
 * @return {string} regular expression representation of filter text
 */
function filterToRegExp(text, captureAll = false)
{
  // remove multiple wildcards
  text = text.replace(/\*+/g, "*");

  if (!captureAll)
  {
    // remove leading wildcard
    if (text[0] == "*")
      text = text.substring(1);

    // remove trailing wildcard
    if (text[text.length - 1] == "*")
      text = text.substring(0, text.length - 1);
  }

  return text
    // remove anchors following separator placeholder
    .replace(/\^\|$/, "^")
    // escape special symbols
    .replace(/\W/g, "\\$&")
    // replace wildcards by .*
    .replace(/\\\*/g, ".*")
    // process separator placeholders (all ANSI characters but alphanumeric
    // characters and _%.-)
    .replace(/\\\^/g, "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)")
    // process extended anchor at expression start
    .replace(/^\\\|\\\|/, "^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?")
    // process anchor at expression start
    .replace(/^\\\|/, "^")
    // process anchor at expression end
    .replace(/\\\|$/, "$");
}

exports.filterToRegExp = filterToRegExp;

function splitSelector(selector)
{
  if (!selector.includes(","))
    return [selector];

  let selectors = [];
  let start = 0;
  let level = 0;
  let sep = "";

  for (let i = 0; i < selector.length; i++)
  {
    let chr = selector[i];

    if (chr == "\\")        // ignore escaped characters
      i++;
    else if (chr == sep)    // don't split within quoted text
      sep = "";             // e.g. [attr=","]
    else if (sep == "")
    {
      if (chr == '"' || chr == "'")
        sep = chr;
      else if (chr == "(")  // don't split between parentheses
        level++;            // e.g. :matches(div,span)
      else if (chr == ")")
        level = Math.max(0, level - 1);
      else if (chr == "," && level == 0)
      {
        selectors.push(selector.substring(start, i));
        start = i + 1;
      }
    }
  }

  selectors.push(selector.substring(start));
  return selectors;
}

exports.splitSelector = splitSelector;

function findTargetSelectorIndex(selector)
{
  let index = 0;
  let whitespace = 0;
  let scope = [];

  // Start from the end of the string and go character by character, where each
  // character is a Unicode code point.
  for (let character of [...selector].reverse())
  {
    let currentScope = scope[scope.length - 1];

    if (character == "'" || character == "\"")
    {
      // If we're already within the same type of quote, close the scope;
      // otherwise open a new scope.
      if (currentScope == character)
        scope.pop();
      else
        scope.push(character);
    }
    else if (character == "]" || character == ")")
    {
      // For closing brackets and parentheses, open a new scope only if we're
      // not within a quote. Within quotes these characters should have no
      // meaning.
      if (currentScope != "'" && currentScope != "\"")
        scope.push(character);
    }
    else if (character == "[")
    {
      // If we're already within a bracket, close the scope.
      if (currentScope == "]")
        scope.pop();
    }
    else if (character == "(")
    {
      // If we're already within a parenthesis, close the scope.
      if (currentScope == ")")
        scope.pop();
    }
    else if (!currentScope)
    {
      // At the top level (not within any scope), count the whitespace if we've
      // encountered it. Otherwise if we've hit one of the combinators,
      // terminate here; otherwise if we've hit a non-colon character,
      // terminate here.
      if (/\s/.test(character))
      {
        whitespace++;
      }
      else if ((character == ">" || character == "+" || character == "~") ||
               (whitespace > 0 && character != ":"))
      {
        break;
      }
    }

    // Zero out the whitespace count if we've entered a scope.
    if (scope.length > 0)
      whitespace = 0;

    // Increment the index by the size of the character. Note that for Unicode
    // composite characters (like emoji) this will be more than one.
    index += character.length;
  }

  return selector.length - index + whitespace;
}

/**
 * Qualifies a CSS selector with a qualifier, which may be another CSS selector
 * or an empty string. For example, given the selector "div.bar" and the
 * qualifier "#foo", this function returns "div#foo.bar".
 * @param {string} selector The selector to qualify.
 * @param {string} qualifier The qualifier with which to qualify the selector.
 * @returns {string} The qualified selector.
 */
function qualifySelector(selector, qualifier)
{
  let qualifiedSelector = "";

  for (let sub of splitSelector(selector))
  {
    sub = sub.trim();

    qualifiedSelector += ", ";

    let index = findTargetSelectorIndex(sub);
    let [, type = "", rest] = /^([a-z][a-z-]*)?(.*)/i.exec(sub.substr(index));

    // Note that the first group in the regular expression is optional. If it
    // doesn't match (e.g. "#foo::nth-child(1)"), type will be an empty string.
    qualifiedSelector += sub.substr(0, index) + type + qualifier + rest;
  }

  // Remove the initial comma and space.
  return qualifiedSelector.substr(2);
}

exports.qualifySelector = qualifySelector;


/***/ }),
/* 21 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * @fileOverview INI parsing.
 */

const {Filter} = __webpack_require__(0);
const {Subscription} = __webpack_require__(5);

/**
 * Parses filter data.
 */
class INIParser
{
  constructor()
  {
    /**
     * Properties of the filter data.
     * @type {object}
     */
    this.fileProperties = {};

    /**
     * The list of subscriptions in the filter data.
     * @type {Array.<Subscription>}
     */
    this.subscriptions = [];

    /**
     * Known filter texts mapped to their corresponding {@link Filter} objects.
     * @type {Map.<string, Filter>}
     */
    this.knownFilters = new Map();

    /**
     * Known subscription URLs mapped to their corresponding
     * {@link Subscription} objects.
     * @type {Map.<string, Subscription>}
     */
    this.knownSubscriptions = new Map();

    this._wantObj = true;
    this._curObj = this.fileProperties;
    this._curSection = null;
  }

  /**
   * Processes a line of filter data.
   *
   * @param {string?} line The line of filter data to process. This may be
   *   <code>null</code>, which indicates the end of the filter data.
   */
  process(line)
  {
    let origKnownFilters = Filter.knownFilters;
    Filter.knownFilters = this.knownFilters;

    let origKnownSubscriptions = Subscription.knownSubscriptions;
    Subscription.knownSubscriptions = this.knownSubscriptions;

    try
    {
      let match;
      if (this._wantObj === true && (match = /^(\w+)=(.*)$/.exec(line)))
      {
        this._curObj[match[1]] = match[2];
      }
      else if (line === null || (match = /^\s*\[(.+)\]\s*$/.exec(line)))
      {
        if (this._curObj)
        {
          // Process current object before going to next section
          switch (this._curSection)
          {
            case "filter":
              if ("text" in this._curObj)
                Filter.fromObject(this._curObj);
              break;

            case "subscription":
              let subscription = Subscription.fromObject(this._curObj);
              if (subscription)
                this.subscriptions.push(subscription);
              break;

            case "subscription filters":
              if (this.subscriptions.length)
              {
                let currentSubscription = this.subscriptions[
                  this.subscriptions.length - 1
                ];
                for (let text of this._curObj)
                {
                  let filter = Filter.fromText(text);
                  currentSubscription.filters.push(filter);
                  filter.addSubscription(currentSubscription);
                }
              }
              break;
          }
        }

        if (line === null)
          return;

        this._curSection = match[1].toLowerCase();
        switch (this._curSection)
        {
          case "filter":
          case "subscription":
            this._wantObj = true;
            this._curObj = {};
            break;
          case "subscription filters":
            this._wantObj = false;
            this._curObj = [];
            break;
          default:
            this._wantObj = null;
            this._curObj = null;
        }
      }
      else if (this._wantObj === false && line)
      {
        this._curObj.push(line.replace(/\\\[/g, "["));
      }
    }
    finally
    {
      Filter.knownFilters = origKnownFilters;
      Subscription.knownSubscriptions = origKnownSubscriptions;
    }
  }
}

exports.INIParser = INIParser;


/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



{
  let {chooseFilterSubscriptions} = __webpack_require__(14);

  QUnit.module("Subscription", {
    setup()
    {
      let {Utils} = __webpack_require__(6);
      Object.defineProperty(Utils, "appLocale",
                            {value: "en", enumerable: true});
    }
  });


  test("Choosing filter subscriptions", assert =>
  {
    let done = assert.async();
    fetch("subscriptions.xml")
      .then(response => response.text())
      .then(text =>
      {
        let doc = new DOMParser().parseFromString(text, "application/xml");
        let nodes = doc.getElementsByTagName("subscription");

        let subs = chooseFilterSubscriptions(nodes);
        assert.ok(subs);
        assert.ok(subs.circumvention);
        assert.ok(subs.ads);

        assert.equal(subs.circumvention.getAttribute("prefixes"),
                     "de,en,en-US");
        assert.equal(subs.circumvention.getAttribute("type"), "circumvention");
        assert.equal(subs.ads.getAttribute("prefixes"), "en");
        assert.equal(subs.ads.getAttribute("type"), "ads");

        done();
      })
      .catch(() =>
      {
        assert.ok(false);

        done();
      });
  });
}


/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * @fileOverview Manages synchronization of filter subscriptions.
 */

const {Downloader, Downloadable,
       MILLIS_IN_SECOND, MILLIS_IN_MINUTE,
       MILLIS_IN_HOUR, MILLIS_IN_DAY} = __webpack_require__(15);
const {Filter} = __webpack_require__(0);
const {FilterStorage} = __webpack_require__(4);
const {filterNotifier} = __webpack_require__(2);
const {Prefs} = __webpack_require__(3);
const {Subscription,
       DownloadableSubscription} = __webpack_require__(5);

const INITIAL_DELAY = 1 * MILLIS_IN_MINUTE;
const CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
const DEFAULT_EXPIRATION_INTERVAL = 5 * MILLIS_IN_DAY;

/**
 * Downloads filter subscriptions whenever necessary.
 */
class Synchronizer
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    /**
     * The object providing actual downloading functionality.
     * @type {Downloader}
     */
    this._downloader = new Downloader(this._getDownloadables.bind(this),
                                      INITIAL_DELAY, CHECK_INTERVAL);
    onShutdown.add(() =>
    {
      this._downloader.cancel();
    });

    this._downloader.onExpirationChange = this._onExpirationChange.bind(this);
    this._downloader.onDownloadStarted = this._onDownloadStarted.bind(this);
    this._downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    this._downloader.onDownloadError = this._onDownloadError.bind(this);
  }

  /**
   * Checks whether a subscription is currently being downloaded.
   * @param {string} url  URL of the subscription
   * @returns {boolean}
   */
  isExecuting(url)
  {
    return this._downloader.isDownloading(url);
  }

  /**
   * Starts the download of a subscription.
   * @param {DownloadableSubscription} subscription
   *   Subscription to be downloaded
   * @param {boolean} manual
   *   <code>true</code> for a manually started download (should not trigger
   *   fallback requests)
   */
  execute(subscription, manual)
  {
    this._downloader.download(this._getDownloadable(subscription, manual));
  }

  /**
   * Yields {@link Downloadable} instances for all subscriptions that can be
   * downloaded.
   * @yields {Downloadable}
   */
  *_getDownloadables()
  {
    if (!Prefs.subscriptions_autoupdate)
      return;

    for (let subscription of FilterStorage.subscriptions)
    {
      if (subscription instanceof DownloadableSubscription)
        yield this._getDownloadable(subscription, false);
    }
  }

  /**
   * Creates a {@link Downloadable} instance for a subscription.
   * @param {Subscription} subscription
   * @param {boolean} manual
   * @returns {Downloadable}
   */
  _getDownloadable(subscription, manual)
  {
    let result = new Downloadable(subscription.url);
    if (subscription.lastDownload != subscription.lastSuccess)
      result.lastError = subscription.lastDownload * MILLIS_IN_SECOND;
    result.lastCheck = subscription.lastCheck * MILLIS_IN_SECOND;
    result.lastVersion = subscription.version;
    result.softExpiration = subscription.softExpiration * MILLIS_IN_SECOND;
    result.hardExpiration = subscription.expires * MILLIS_IN_SECOND;
    result.manual = manual;
    result.downloadCount = subscription.downloadCount;
    return result;
  }

  _onExpirationChange(downloadable)
  {
    let subscription = Subscription.fromURL(downloadable.url);
    subscription.lastCheck = Math.round(
      downloadable.lastCheck / MILLIS_IN_SECOND
    );
    subscription.softExpiration = Math.round(
      downloadable.softExpiration / MILLIS_IN_SECOND
    );
    subscription.expires = Math.round(
      downloadable.hardExpiration / MILLIS_IN_SECOND
    );
  }

  _onDownloadStarted(downloadable)
  {
    let subscription = Subscription.fromURL(downloadable.url);
    filterNotifier.emit("subscription.downloading", subscription);
  }

  _onDownloadSuccess(downloadable, responseText, errorCallback,
                     redirectCallback)
  {
    let lines = responseText.split(/[\r\n]+/);
    let headerMatch = /\[Adblock(?:\s*Plus\s*([\d.]+)?)?\]/i.exec(lines[0]);
    if (!headerMatch)
      return errorCallback("synchronize_invalid_data");
    let minVersion = headerMatch[1];

    let params = {
      redirect: null,
      homepage: null,
      title: null,
      version: null,
      expires: null
    };
    for (let i = 1; i < lines.length; i++)
    {
      let match = /^\s*!\s*(.*?)\s*:\s*(.*)/.exec(lines[i]);
      if (!match)
        break;

      let keyword = match[1].toLowerCase();
      if (params.hasOwnProperty(keyword))
      {
        params[keyword] = match[2];
        lines.splice(i--, 1);
      }
    }

    if (params.redirect)
      return redirectCallback(params.redirect);

    // Handle redirects
    let subscription = Subscription.fromURL(downloadable.redirectURL ||
                                            downloadable.url);
    if (downloadable.redirectURL &&
        downloadable.redirectURL != downloadable.url)
    {
      let oldSubscription = Subscription.fromURL(downloadable.url);
      subscription.title = oldSubscription.title;
      subscription.disabled = oldSubscription.disabled;
      subscription.lastCheck = oldSubscription.lastCheck;

      let listed = FilterStorage.knownSubscriptions.has(oldSubscription.url);
      if (listed)
        FilterStorage.removeSubscription(oldSubscription);

      Subscription.knownSubscriptions.delete(oldSubscription.url);

      if (listed)
        FilterStorage.addSubscription(subscription);
    }

    // The download actually succeeded
    subscription.lastSuccess = subscription.lastDownload = Math.round(
      Date.now() / MILLIS_IN_SECOND
    );
    subscription.downloadStatus = "synchronize_ok";
    subscription.downloadCount = downloadable.downloadCount;
    subscription.errors = 0;

    // Process parameters
    if (params.homepage)
    {
      let url;
      try
      {
        url = new URL(params.homepage);
      }
      catch (e)
      {
        url = null;
      }

      if (url && (url.protocol == "http:" || url.protocol == "https:"))
        subscription.homepage = url.href;
    }

    if (params.title)
    {
      subscription.title = params.title;
      subscription.fixedTitle = true;
    }
    else
      subscription.fixedTitle = false;

    subscription.version = (params.version ? parseInt(params.version, 10) : 0);

    let expirationInterval = DEFAULT_EXPIRATION_INTERVAL;
    if (params.expires)
    {
      let match = /^(\d+)\s*(h)?/.exec(params.expires);
      if (match)
      {
        let interval = parseInt(match[1], 10);
        if (match[2])
          expirationInterval = interval * MILLIS_IN_HOUR;
        else
          expirationInterval = interval * MILLIS_IN_DAY;
      }
    }

    let [
      softExpiration,
      hardExpiration
    ] = this._downloader.processExpirationInterval(expirationInterval);
    subscription.softExpiration = Math.round(softExpiration / MILLIS_IN_SECOND);
    subscription.expires = Math.round(hardExpiration / MILLIS_IN_SECOND);

    if (minVersion)
      subscription.requiredVersion = minVersion;
    else
      delete subscription.requiredVersion;

    // Process filters
    lines.shift();
    let filters = [];
    for (let line of lines)
    {
      line = Filter.normalize(line);
      if (line)
        filters.push(Filter.fromText(line));
    }

    FilterStorage.updateSubscriptionFilters(subscription, filters);
  }

  _onDownloadError(downloadable, downloadURL, error, channelStatus,
                   responseStatus, redirectCallback)
  {
    let subscription = Subscription.fromURL(downloadable.url);
    subscription.lastDownload = Math.round(Date.now() / MILLIS_IN_SECOND);
    subscription.downloadStatus = error;

    // Request fallback URL if necessary - for automatic updates only
    if (!downloadable.manual)
    {
      subscription.errors++;

      if (redirectCallback &&
          subscription.errors >= Prefs.subscriptions_fallbackerrors &&
          /^https?:\/\//i.test(subscription.url))
      {
        subscription.errors = 0;

        let fallbackURL = Prefs.subscriptions_fallbackurl;
        const {addonVersion} = __webpack_require__(1);
        fallbackURL = fallbackURL.replace(/%VERSION%/g,
                                          encodeURIComponent(addonVersion));
        fallbackURL = fallbackURL.replace(/%SUBSCRIPTION%/g,
                                          encodeURIComponent(subscription.url));
        fallbackURL = fallbackURL.replace(/%URL%/g,
                                          encodeURIComponent(downloadURL));
        fallbackURL = fallbackURL.replace(/%ERROR%/g,
                                          encodeURIComponent(error));
        fallbackURL = fallbackURL.replace(/%CHANNELSTATUS%/g,
                                          encodeURIComponent(channelStatus));
        fallbackURL = fallbackURL.replace(/%RESPONSESTATUS%/g,
                                          encodeURIComponent(responseStatus));

        let request = new XMLHttpRequest();
        request.mozBackgroundRequest = true;
        request.open("GET", fallbackURL);
        request.overrideMimeType("text/plain");
        request.channel.loadFlags = request.channel.loadFlags |
                                    request.channel.INHIBIT_CACHING |
                                    request.channel.VALIDATE_ALWAYS;
        request.addEventListener("load", ev =>
        {
          if (onShutdown.done)
            return;

          if (!FilterStorage.knownSubscriptions.has(subscription.url))
            return;

          let match = /^(\d+)(?:\s+(\S+))?$/.exec(request.responseText);
          if (match && match[1] == "301" &&    // Moved permanently
              match[2] && /^https?:\/\//i.test(match[2]))
          {
            redirectCallback(match[2]);
          }
          else if (match && match[1] == "410") // Gone
          {
            let data = "[Adblock]\n" +
              subscription.filters.map(f => f.text).join("\n");
            redirectCallback("data:text/plain," + encodeURIComponent(data));
          }
        }, false);
        request.send(null);
      }
    }
  }
}

/**
 * This object is responsible for downloading filter subscriptions whenever
 * necessary.
 * @type {Synchronizer}
 */
let synchronizer = new Synchronizer();

exports.Synchronizer = synchronizer;


/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module notificationHelper */



const {startIconAnimation, stopIconAnimation} = __webpack_require__(25);
const {Utils} = __webpack_require__(6);
const {Notification: NotificationStorage} =
  __webpack_require__(16);
const {initAntiAdblockNotification} =
  __webpack_require__(26);
const {Prefs} = __webpack_require__(3);
const {showOptions} = __webpack_require__(27);
const info = __webpack_require__(1);

let activeNotification = null;
let activeButtons = null;
let defaultDisplayMethods = ["popup"];
let displayMethods = Object.create(null);
displayMethods.critical = ["icon", "notification", "popup"];
displayMethods.question = ["notification"];
displayMethods.normal = ["notification"];
displayMethods.relentless = ["notification"];
displayMethods.information = ["icon", "popup"];

function prepareNotificationIconAndPopup()
{
  let animateIcon = shouldDisplay("icon", activeNotification.type);
  activeNotification.onClicked = () =>
  {
    if (animateIcon)
      stopIconAnimation();
    notificationClosed();
  };
  if (animateIcon)
    startIconAnimation(activeNotification.type);
}

function getNotificationButtons(notificationType, message)
{
  let buttons = [];
  if (notificationType == "question")
  {
    buttons.push({
      type: "question",
      title: browser.i18n.getMessage("overlay_notification_button_yes")
    });
    buttons.push({
      type: "question",
      title: browser.i18n.getMessage("overlay_notification_button_no")
    });
  }
  else
  {
    let regex = /<a>(.*?)<\/a>/g;
    let match;
    while (match = regex.exec(message))
    {
      buttons.push({
        type: "link",
        title: match[1]
      });
    }

    // Chrome only allows two notification buttons so we need to fall back
    // to a single button to open all links if there are more than two.
    let maxButtons = (notificationType == "critical") ? 2 : 1;
    if (buttons.length > maxButtons)
    {
      buttons = [
        {
          type: "open-all",
          title: browser.i18n.getMessage("notification_open_all")
        }
      ];
    }
    if (!["critical", "relentless"].includes(notificationType))
    {
      buttons.push({
        type: "configure",
        title: browser.i18n.getMessage("notification_configure")
      });
    }
  }

  return buttons;
}

function openNotificationLinks()
{
  if (activeNotification.links)
  {
    for (let link of activeNotification.links)
      browser.tabs.create({url: Utils.getDocLink(link)});
  }
}

function notificationButtonClick(buttonIndex)
{
  if (!(activeButtons && buttonIndex in activeButtons))
    return;

  switch (activeButtons[buttonIndex].type)
  {
    case "link":
      browser.tabs.create({
        url: Utils.getDocLink(activeNotification.links[buttonIndex])
      });
      break;
    case "open-all":
      openNotificationLinks();
      break;
    case "configure":
      Prefs.notifications_showui = true;
      showOptions((page, port) =>
      {
        port.postMessage({
          type: "app.respond",
          action: "focusSection",
          args: ["notifications"]
        });
      });
      break;
    case "question":
      NotificationStorage.triggerQuestionListeners(activeNotification.id,
                                                   buttonIndex == 0);
      NotificationStorage.markAsShown(activeNotification.id);
      activeNotification.onClicked();
      break;
  }
}

function notificationClosed()
{
  activeNotification = null;
}

function initChromeNotifications()
{
  // Chrome hides notifications in notification center when clicked so
  // we need to clear them.
  function clearActiveNotification(notificationId)
  {
    if (activeNotification &&
        activeNotification.type != "question" &&
        !("links" in activeNotification))
      return;

    browser.notifications.clear(notificationId, wasCleared =>
    {
      if (wasCleared)
        notificationClosed();
    });
  }

  browser.notifications.onButtonClicked.addListener(
    (notificationId, buttonIndex) =>
    {
      notificationButtonClick(buttonIndex);
      clearActiveNotification(notificationId);
    }
  );
  browser.notifications.onClicked.addListener(clearActiveNotification);
  browser.notifications.onClosed.addListener(notificationClosed);
}

function showNotification(notification)
{
  if (activeNotification && activeNotification.id == notification.id)
    return;

  activeNotification = notification;
  if (shouldDisplay("notification", activeNotification.type))
  {
    let texts = NotificationStorage.getLocalizedTexts(notification);
    let title = texts.title || "";
    let message = (texts.message || "").replace(/<\/?(a|strong)>/g, "");
    let iconUrl = browser.extension.getURL("icons/detailed/abp-128.png");
    let linkCount = (activeNotification.links || []).length;

    // Newer versions of Microsoft Edge (EdgeHTML 17) have the notifications
    // API, but the entire browser crashes when it is used.
    // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/20146233/
    if (info.platform != "edgehtml")
    {
      activeButtons = getNotificationButtons(activeNotification.type,
                                             texts.message);
      let notificationOptions = {
        type: "basic",
        title,
        iconUrl,
        message,
        buttons: activeButtons.map(button => ({title: button.title})),
        // We use the highest priority to prevent the notification
        // from closing automatically.
        priority: 2
      };

      // Firefox and Opera don't support buttons. Firefox throws synchronously,
      // while Opera gives an asynchronous error. Wrapping the promise like
      // this, turns the synchronous error on Firefox into a promise rejection.
      new Promise(resolve =>
      {
        resolve(browser.notifications.create(notificationOptions));
      }).catch(() =>
      {
        // Without buttons, showing notifications of the type "question" is
        // pointless. For other notifications, retry with the buttons removed.
        if (activeNotification.type != "question")
        {
          delete notificationOptions.buttons;
          browser.notifications.create(notificationOptions);
        }
      });
    }
    else if ("Notification" in window && activeNotification.type != "question")
    {
      if (linkCount > 0)
      {
        message += " " + browser.i18n.getMessage(
          "notification_without_buttons"
        );
      }

      let widget = new Notification(
        title,
        {
          lang: Utils.appLocale,
          dir: Utils.readingDirection,
          body: message,
          icon: iconUrl
        }
      );

      widget.addEventListener("click", openNotificationLinks);
      widget.addEventListener("close", notificationClosed);
    }
    else
    {
      message = title + "\n" + message;
      if (linkCount > 0)
      {
        message += "\n\n" + browser.i18n.getMessage(
          "notification_with_buttons"
        );
      }

      let approved = confirm(message);
      if (activeNotification.type == "question")
        notificationButtonClick(approved ? 0 : 1);
      else if (approved)
        openNotificationLinks();
    }
  }
  prepareNotificationIconAndPopup();

  if (notification.type !== "question")
    NotificationStorage.markAsShown(notification.id);
}

/**
 * Initializes the notification system.
 */
exports.initNotifications = () =>
{
  if (info.platform != "edgehtml")
    initChromeNotifications();
  initAntiAdblockNotification();
};

/**
 * Gets the active notification to be shown if any.
 *
 * @return {?object}
 */
exports.getActiveNotification = () => activeNotification;

let shouldDisplay =
/**
 * Determines whether a given display method should be used for a
 * specified notification type.
 *
 * @param {string} method Display method: icon, notification or popup
 * @param {string} notificationType
 * @return {boolean}
 */
exports.shouldDisplay = (method, notificationType) =>
{
  let methods = displayMethods[notificationType] || defaultDisplayMethods;
  return methods.includes(method);
};

/**
 * Tidies up after a notification was clicked.
 */
exports.notificationClicked = () =>
{
  if (activeNotification)
    activeNotification.onClicked();
};

ext.pages.onLoading.addListener(page =>
{
  NotificationStorage.showNext(page.url.href);
});

NotificationStorage.addShowListener(showNotification);


/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module icon */



const {filterNotifier} = __webpack_require__(2);

const frameOpacities = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
                        1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
                        0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];
const numberOfFrames = frameOpacities.length;

let stopRequested = false;
let canUpdateIcon = true;
let notRunning = Promise.resolve();
let whitelistedState = new ext.PageMap();

function loadImage(url)
{
  return new Promise((resolve, reject) =>
  {
    let image = new Image();
    image.src = url;
    image.addEventListener("load", () =>
    {
      resolve(image);
    });
    image.addEventListener("error", () =>
    {
      reject("Failed to load image " + url);
    });
  });
}

function setIcon(page, notificationType, opacity, frames)
{
  opacity = opacity || 0;
  let whitelisted = !!whitelistedState.get(page);

  if (!notificationType || !frames)
  {
    if (opacity > 0.5)
    {
      page.browserAction.setIcon("/icons/abp-$size-notification-" +
                                 notificationType + ".png");
    }
    else
    {
      page.browserAction.setIcon("/icons/abp-$size" +
                                 (whitelisted ? "-whitelisted" : "") + ".png");
    }
  }
  else
  {
    browser.browserAction.setIcon({
      tabId: page.id,
      imageData: frames["" + opacity + whitelisted]
    });
  }
}

filterNotifier.on("page.WhitelistingStateRevalidate", (page, filter) =>
{
  whitelistedState.set(page, !!filter);
  if (canUpdateIcon)
    setIcon(page);
});

function renderFrames(notificationType)
{
  return Promise.all([
    loadImage("icons/abp-16.png"),
    loadImage("icons/abp-16-whitelisted.png"),
    loadImage("icons/abp-16-notification-" + notificationType + ".png"),
    loadImage("icons/abp-19.png"),
    loadImage("icons/abp-19-whitelisted.png"),
    loadImage("icons/abp-19-notification-" + notificationType + ".png"),
    loadImage("icons/abp-20.png"),
    loadImage("icons/abp-20-whitelisted.png"),
    loadImage("icons/abp-20-notification-" + notificationType + ".png"),
    loadImage("icons/abp-32.png"),
    loadImage("icons/abp-32-whitelisted.png"),
    loadImage("icons/abp-32-notification-" + notificationType + ".png"),
    loadImage("icons/abp-38.png"),
    loadImage("icons/abp-38-whitelisted.png"),
    loadImage("icons/abp-38-notification-" + notificationType + ".png"),
    loadImage("icons/abp-40.png"),
    loadImage("icons/abp-40-whitelisted.png"),
    loadImage("icons/abp-40-notification-" + notificationType + ".png")
  ]).then(images =>
  {
    let imageMap = {
      16: {base: [images[0], images[1]], overlay: images[2]},
      19: {base: [images[3], images[4]], overlay: images[5]},
      20: {base: [images[6], images[7]], overlay: images[8]},
      32: {base: [images[9], images[10]], overlay: images[11]},
      38: {base: [images[12], images[13]], overlay: images[14]},
      40: {base: [images[15], images[16]], overlay: images[17]}
    };

    let frames = {};
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");

    for (let whitelisted of [false, true])
    {
      for (let i = 0, opacity = 0; i <= 10; opacity = ++i / 10)
      {
        let imageData = {};
        let sizes = [16, 19, 20, 32, 38, 40];
        for (let size of sizes)
        {
          canvas.width = size;
          canvas.height = size;
          context.globalAlpha = 1;
          context.drawImage(imageMap[size]["base"][whitelisted | 0], 0, 0);
          context.globalAlpha = opacity;
          context.drawImage(imageMap[size]["overlay"], 0, 0);
          imageData[size] = context.getImageData(0, 0, size, size);
        }
        frames["" + opacity + whitelisted] = imageData;
      }
    }

    return frames;
  });
}

function animateIcon(notificationType, frames)
{
  browser.tabs.query({active: true}, tabs =>
  {
    let pages = tabs.map(tab => new ext.Page(tab));

    let animationStep = 0;
    let opacity = 0;

    let onActivated = page =>
    {
      pages.push(page);
      setIcon(page, notificationType, opacity, frames);
    };
    ext.pages.onActivated.addListener(onActivated);

    canUpdateIcon = false;
    let interval = setInterval(() =>
    {
      let oldOpacity = opacity;
      opacity = frameOpacities[animationStep++];

      if (opacity != oldOpacity)
      {
        for (let page of pages)
        {
          if (whitelistedState.has(page))
            setIcon(page, notificationType, opacity, frames);
        }
      }

      if (animationStep > numberOfFrames)
      {
        clearInterval(interval);
        ext.pages.onActivated.removeListener(onActivated);
        canUpdateIcon = true;
      }
    }, 100);
  });
}

let stopIconAnimation =
/**
 * Stops to animate the browser action icon
 * after the current interval has been finished.
 *
 * @return {Promise} A promise that is fullfilled when
 *                   the icon animation has been stopped.
 */
exports.stopIconAnimation = () =>
{
  stopRequested = true;
  return notRunning.then(() =>
  {
    stopRequested = false;
  });
};

/**
 * Starts to animate the browser action icon to indicate a pending notifcation.
 * If the icon is already animated, it replaces the previous
 * animation as soon as the current interval has been finished.
 *
 * @param {string} type  The notification type (i.e: "information" or
 *                       "critical".)
 */
exports.startIconAnimation = type =>
{
  notRunning = new Promise(resolve =>
  {
    Promise.all([renderFrames(type), stopIconAnimation()]).then(results =>
    {
      if (stopRequested)
      {
        resolve();
        return;
      }

      let frames = results[0];
      animateIcon(type, frames);

      let interval = setInterval(() =>
      {
        if (stopRequested)
        {
          clearInterval(interval);
          resolve();
          return;
        }

        animateIcon(type, frames);
      }, 10000);
    });
  });
};


/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



const {Prefs} = __webpack_require__(3);
const {ActiveFilter} = __webpack_require__(0);
const {FilterStorage} = __webpack_require__(4);
const {filterNotifier} = __webpack_require__(2);
const {Subscription} = __webpack_require__(5);
const {Notification} = __webpack_require__(16);

exports.initAntiAdblockNotification = function initAntiAdblockNotification()
{
  const notification = {
    id: "antiadblock",
    type: "question",
    title: browser.i18n.getMessage("notification_antiadblock_title"),
    message: browser.i18n.getMessage("notification_antiadblock_message"),
    urlFilters: []
  };

  function notificationListener(approved)
  {
    const subanti = Prefs.subscriptions_antiadblockurl;
    const subscription = Subscription.fromURL(subanti);
    if (FilterStorage.knownSubscriptions.has(subscription.url))
      subscription.disabled = !approved;
  }

  function addAntiAdblockNotification(subscription)
  {
    const urlFilters = [];
    for (const filter of subscription.filters)
    {
      if (filter instanceof ActiveFilter && filter.domains)
      {
        for (const [domain, included] of filter.domains)
        {
          const urlFilter = "||" + domain + "^$document";
          if (domain && included && urlFilters.indexOf(urlFilter) == -1)
            urlFilters.push(urlFilter);
        }
      }
    }
    notification.urlFilters = urlFilters;
    Notification.addNotification(notification);
    Notification.addQuestionListener(notification.id, notificationListener);
  }

  function removeAntiAdblockNotification()
  {
    Notification.removeNotification(notification);
    Notification.removeQuestionListener(notification.id, notificationListener);
  }

  const antiAdblockSubscription = Subscription.fromURL(
    Prefs.subscriptions_antiadblockurl
  );
  if (antiAdblockSubscription.lastDownload && antiAdblockSubscription.disabled)
    addAntiAdblockNotification(antiAdblockSubscription);

  function onSubscriptionChange(subscription)
  {
    const url = Prefs.subscriptions_antiadblockurl;
    if (url != subscription.url)
      return;

    if (FilterStorage.knownSubscriptions.has(url) && subscription.disabled)
      addAntiAdblockNotification(subscription);
    else
      removeAntiAdblockNotification();
  }

  filterNotifier.on("subscription.updated", onSubscriptionChange);
  filterNotifier.on("subscription.removed", onSubscriptionChange);
  filterNotifier.on("subscription.disabled", onSubscriptionChange);
};


/***/ }),
/* 27 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module options */



const {checkWhitelisted} = __webpack_require__(17);
const info = __webpack_require__(1);

const manifest = browser.runtime.getManifest();
const optionsUrl = manifest.options_page || manifest.options_ui.page;

function findOptionsTab(callback)
{
  browser.tabs.query({}, tabs =>
  {
    // We find a tab ourselves because Edge has a bug when quering tabs with
    // extension URL protocol:
    // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8094141/
    // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8604703/
    // Firefox won't let us query for moz-extension:// pages either, though
    // starting with Firefox 56 an extension can query for its own URLs:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1271354
    let fullOptionsUrl = browser.extension.getURL(optionsUrl);
    let optionsTab = tabs.find(tab => tab.url == fullOptionsUrl);
    if (optionsTab)
    {
      callback(optionsTab);
      return;
    }

    // Newly created tabs might have about:blank as their URL in Firefox
    // or undefined in Microsoft Edge rather than the final options page URL,
    // we need to wait for those to finish loading.
    let potentialOptionTabIds = new Set(
      tabs.filter(tab =>
            (tab.url == "about:blank" || !tab.url) && tab.status == "loading")
          .map(tab => tab.id)
    );
    if (potentialOptionTabIds.size == 0)
    {
      callback();
      return;
    }
    let removeListener;
    let updateListener = (tabId, changeInfo, tab) =>
    {
      if (potentialOptionTabIds.has(tabId) &&
          changeInfo.status == "complete")
      {
        potentialOptionTabIds.delete(tabId);
        let urlMatch = tab.url == fullOptionsUrl;
        if (urlMatch || potentialOptionTabIds.size == 0)
        {
          browser.tabs.onUpdated.removeListener(updateListener);
          browser.tabs.onRemoved.removeListener(removeListener);
          callback(urlMatch ? tab : undefined);
        }
      }
    };
    browser.tabs.onUpdated.addListener(updateListener);
    removeListener = removedTabId =>
    {
      potentialOptionTabIds.delete(removedTabId);
      if (potentialOptionTabIds.size == 0)
      {
        browser.tabs.onUpdated.removeListener(updateListener);
        browser.tabs.onRemoved.removeListener(removeListener);
        callback();
      }
    };
    browser.tabs.onRemoved.addListener(removeListener);
  });
}

function returnShowOptionsCall(optionsTab, callback)
{
  if (!callback)
    return;

  if (optionsTab)
  {
    callback(new ext.Page(optionsTab));
  }
  else
  {
    // If we don't already have an options page, it means we've just opened
    // one, in which case we must find the tab, wait for it to be ready, and
    // then return the call.
    findOptionsTab(tab =>
    {
      if (!tab)
        return;

      function onMessage(message, port)
      {
        if (message.type != "app.listen")
          return;

        port.onMessage.removeListener(onMessage);
        callback(new ext.Page(tab), port);
      }

      function onConnect(port)
      {
        if (port.name != "ui" || port.sender.tab.id != tab.id)
          return;

        browser.runtime.onConnect.removeListener(onConnect);
        port.onMessage.addListener(onMessage);
      }

      browser.runtime.onConnect.addListener(onConnect);
    });
  }
}

let showOptions =
/**
 * Opens the options page.
 *
 * @param {function} callback
 */
exports.showOptions = callback =>
{
  findOptionsTab(optionsTab =>
  {
    // Older versions of Edge do not support runtime.openOptionsPage
    // (tested version 38).
    if ("openOptionsPage" in browser.runtime &&
        // Newer versions of Edge (tested version 44) do support the API,
        // but it does not function correctly. The options page can be opened
        // repeatedly.
        info.platform != "edgehtml" &&
        // Some versions of Firefox for Android before version 57 do have a
        // runtime.openOptionsPage but it doesn't do anything.
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1364945
        (info.application != "fennec" ||
         parseInt(info.applicationVersion, 10) >= 57))
    {
      browser.runtime.openOptionsPage(() =>
      {
        returnShowOptionsCall(optionsTab, callback);
      });
    }
    else if (optionsTab)
    {
      // Firefox for Android before version 57 does not support
      // runtime.openOptionsPage, nor does it support the windows API.
      // Since there is effectively only one window on the mobile browser,
      // there's no need to bring it into focus.
      if ("windows" in browser)
        browser.windows.update(optionsTab.windowId, {focused: true});

      browser.tabs.update(optionsTab.id, {active: true});

      returnShowOptionsCall(optionsTab, callback);
    }
    else
    {
      // We use a relative URL here because of this Edge issue:
      // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/10276332
      browser.tabs.create({url: optionsUrl}, () =>
      {
        returnShowOptionsCall(optionsTab, callback);
      });
    }
  });
};

// We need to clear the popup URL on Firefox for Android in order for the
// options page to open instead of the bubble. Unfortunately there's a bug[1]
// which prevents us from doing that, so we must avoid setting the URL on
// Firefox from the manifest at all, instead setting it here only for
// non-mobile.
// [1] - https://bugzilla.mozilla.org/show_bug.cgi?id=1414613
if ("getBrowserInfo" in browser.runtime)
{
  Promise.all([browser.browserAction.getPopup({}),
               browser.runtime.getBrowserInfo()]).then(
    ([popup, browserInfo]) =>
    {
      if (!popup && browserInfo.name != "Fennec")
        browser.browserAction.setPopup({popup: "popup.html"});
    }
  );
}

// On Firefox for Android, open the options page directly when the browser
// action is clicked.
browser.browserAction.onClicked.addListener(() =>
{
  browser.tabs.query({active: true, lastFocusedWindow: true}, ([tab]) =>
  {
    let currentPage = new ext.Page(tab);

    showOptions((optionsPage, port) =>
    {
      if (!/^https?:$/.test(currentPage.url.protocol))
        return;

      port.postMessage({
        type: "app.respond",
        action: "showPageOptions",
        args: [
          {
            host: currentPage.url.hostname.replace(/^www\./, ""),
            whitelisted: !!checkWhitelisted(currentPage)
          }
        ]
      });
    });
  });
});


/***/ }),
/* 28 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/* global publicSuffixes */

/** @module tldjs */



/**
 * Get the base domain for given hostname.
 *
 * @param {string} hostname
 * @return {string}
 */
exports.getDomain = hostname =>
{
  let bits = hostname.split(".");
  let cutoff = bits.length - 2;

  for (let i = 0; i < bits.length; i++)
  {
    let offset = publicSuffixes[bits.slice(i).join(".")];

    if (typeof offset != "undefined")
    {
      cutoff = i - offset;
      break;
    }
  }

  if (cutoff <= 0)
    return hostname;

  return bits.slice(cutoff).join(".");
};


/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module hitLogger */



const {extractHostFromFrame} = __webpack_require__(8);
const {EventEmitter} = __webpack_require__(7);
const {FilterStorage} = __webpack_require__(4);
const {port} = __webpack_require__(10);
const {RegExpFilter,
       ElemHideFilter} = __webpack_require__(0);

const nonRequestTypes = exports.nonRequestTypes = [
  "DOCUMENT", "ELEMHIDE", "SNIPPET", "GENERICBLOCK", "GENERICHIDE", "CSP"
];

let eventEmitter = new EventEmitter();

/**
 * @namespace
 * @static
 */
let HitLogger = exports.HitLogger = {
  /**
   * Adds a listener for requests, filter hits etc related to the tab.
   *
   * Note: Calling code is responsible for removing the listener again,
   *       it will not be automatically removed when the tab is closed.
   *
   * @param {number} tabId
   * @param {function} listener
   */
  addListener: eventEmitter.on.bind(eventEmitter),

  /**
   * Removes a listener for the tab.
   *
   * @param {number} tabId
   * @param {function} listener
   */
  removeListener: eventEmitter.off.bind(eventEmitter),

  /**
   * Checks whether a tab is being inspected by anything.
   *
   * @param {number} tabId
   * @return {boolean}
   */
  hasListener(tabId)
  {
    let listeners = eventEmitter._listeners.get(tabId);
    return listeners && listeners.length > 0;
  }
};

/**
 * Logs a request associated with a tab or multiple tabs.
 *
 * @param {number[]} tabIds
 *   The tabIds associated with the request
 * @param {Object} request
 *   The request to log
 * @param {string} request.url
 *   The URL of the request
 * @param {string} request.type
 *  The request type
 * @param {string} request.docDomain
 *  The hostname of the document
 * @param {boolean} request.thirdParty
 *   Whether the origin of the request and document differs
 * @param {?string} request.sitekey
 *   The active sitekey if there is any
 * @param {?boolean} request.specificOnly
 *   Whether generic filters should be ignored
 * @param {?BlockingFilter} filter
 *  The matched filter or null if there is no match
 */
exports.logRequest = (tabIds, request, filter) =>
{
  for (let tabId of tabIds)
    eventEmitter.emit(tabId, request, filter);
};

/**
 * Logs active element hiding filters for a tab.
 *
 * @param {number}   tabId      The ID of the tab, the elements were hidden in
 * @param {string[]} selectors  The selectors of applied ElemHideFilters
 * @param {string[]} filters    The text of applied ElemHideEmulationFilters
 * @param {string}   docDomain  The hostname of the document
 */
function logHiddenElements(tabId, selectors, filters, docDomain)
{
  if (HitLogger.hasListener(tabId))
  {
    for (let subscription of FilterStorage.subscriptions)
    {
      if (subscription.disabled)
        continue;

      for (let filter of subscription.filters)
      {
        // We only know the exact filter in case of element hiding emulation.
        // For regular element hiding filters, the content script only knows
        // the selector, so we have to find a filter that has an identical
        // selector and is active on the domain the match was reported from.
        let isActiveElemHideFilter = filter instanceof ElemHideFilter &&
                                     selectors.includes(filter.selector) &&
                                     filter.isActiveOnDomain(docDomain);

        if (isActiveElemHideFilter || filters.includes(filter.text))
          eventEmitter.emit(tabId, {type: "ELEMHIDE", docDomain}, filter);
      }
    }
  }
}

/**
 * Logs a whitelisting filter that disables (some kind of)
 * blocking for a particular document.
 *
 * @param {number}       tabId     The tabId the whitelisting is active for
 * @param {string}       url       The url of the whitelisted document
 * @param {number}       typeMask  The bit mask of whitelisting types checked
 *                                 for
 * @param {string}       docDomain The hostname of the parent document
 * @param {WhitelistFilter} filter The matched whitelisting filter
 */
exports.logWhitelistedDocument = (tabId, url, typeMask, docDomain, filter) =>
{
  if (HitLogger.hasListener(tabId))
  {
    for (let type of nonRequestTypes)
    {
      if (typeMask & filter.contentType & RegExpFilter.typeMap[type])
        eventEmitter.emit(tabId, {url, type, docDomain}, filter);
    }
  }
};

port.on("hitLogger.traceElemHide", (message, sender) =>
{
  logHiddenElements(
    sender.page.id, message.selectors, message.filters,
    extractHostFromFrame(sender.frame)
  );
});


/***/ }),
/* 30 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/* global console */



/**
 * This is a specialized RSA library meant only to verify SHA1-based signatures.
 */

const {BigInteger} = __webpack_require__(31);
const Rusha = __webpack_require__(32);

let rusha = new Rusha();

// Define ASN.1 templates for the data structures used
function seq(...args)
{
  return {type: 0x30, children: args};
}
function obj(id)
{
  return {type: 0x06, content: id};
}
function bitStr(contents)
{
  return {type: 0x03, encapsulates: contents};
}
function intResult(id)
{
  return {type: 0x02, out: id};
}
function octetResult(id)
{
  return {type: 0x04, out: id};
}

// See http://www.cryptopp.com/wiki/Keys_and_Formats#RSA_PublicKey
// 2A 86 48 86 F7 0D 01 01 01 means 1.2.840.113549.1.1.1
let publicKeyTemplate = seq(
  seq(obj("\x2A\x86\x48\x86\xF7\x0D\x01\x01\x01"), {}),
  bitStr(seq(intResult("n"), intResult("e")))
);

// See http://tools.ietf.org/html/rfc3447#section-9.2 step 2
// 2B 0E 03 02 1A means 1.3.14.3.2.26
let signatureTemplate = seq(
  seq(obj("\x2B\x0E\x03\x02\x1A"), {}),
  octetResult("sha1")
);

/**
 * Reads ASN.1 data matching the template passed in. This will throw an
 * exception if the data format doesn't match the template. On success an
 * object containing result properties is returned.
 * @see http://luca.ntop.org/Teaching/Appunti/asn1.html for info on the format.
 * @param {string} data
 * @param {Object} templ
 * @returns {Object}
 */
function readASN1(data, templ)
{
  let pos = 0;
  function next()
  {
    return data.charCodeAt(pos++);
  }

  function readLength()
  {
    let len = next();
    if (len & 0x80)
    {
      let cnt = len & 0x7F;
      if (cnt > 2 || cnt == 0)
        throw "Unsupported length";

      len = 0;
      for (let i = 0; i < cnt; i++)
        len += next() << (cnt - 1 - i) * 8;
      return len;
    }
    return len;
  }

  function readNode(curTempl)
  {
    let type = next();
    let len = readLength();
    if ("type" in curTempl && curTempl.type != type)
      throw "Unexpected type";
    if ("content" in curTempl && curTempl.content != data.substr(pos, len))
      throw "Unexpected content";
    if ("out" in curTempl)
      out[curTempl.out] = new BigInteger(data.substr(pos, len), 256);
    if ("children" in curTempl)
    {
      let i;
      let end;
      for (i = 0, end = pos + len; pos < end; i++)
      {
        if (i >= curTempl.children.length)
          throw "Too many children";
        readNode(curTempl.children[i]);
      }
      if (i < curTempl.children.length)
        throw "Too few children";
      if (pos > end)
        throw "Children too large";
    }
    else if ("encapsulates" in curTempl)
    {
      if (next() != 0)
        throw "Encapsulation expected";
      readNode(curTempl.encapsulates);
    }
    else
      pos += len;
  }

  let out = {};
  readNode(templ);
  if (pos != data.length)
    throw "Too much data";
  return out;
}

/**
 * Reads a BER-encoded RSA public key. On success returns an object with the
 * properties n and e (the components of the key), otherwise null.
 * @param {string} key
 * @return {?Object}
 */
function readPublicKey(key)
{
  try
  {
    return readASN1(atob(key), publicKeyTemplate);
  }
  catch (e)
  {
    console.warn("Invalid RSA public key: " + e);
    return null;
  }
}

/**
 * Checks whether the signature is valid for the given public key and data.
 * @param {string} key
 * @param {string} signature
 * @param {string} data
 * @return {boolean}
 */
function verifySignature(key, signature, data)
{
  let keyData = readPublicKey(key);
  if (!keyData)
    return false;

  // We need the exponent as regular number
  keyData.e = parseInt(keyData.e.toString(16), 16);

  // Decrypt signature data using RSA algorithm
  let sigInt = new BigInteger(atob(signature), 256);
  let digest = sigInt.modPowInt(keyData.e, keyData.n).toString(256);

  try
  {
    let pos = 0;
    let next = () => digest.charCodeAt(pos++);

    // Skip padding, see http://tools.ietf.org/html/rfc3447#section-9.2 step 5
    if (next() != 1)
      throw "Wrong padding in signature digest";
    while (next() == 255) {}
    if (digest.charCodeAt(pos - 1) != 0)
      throw "Wrong padding in signature digest";

    // Rest is an ASN.1 structure, get the SHA1 hash from it and compare to
    // the real one
    let {sha1} = readASN1(digest.substr(pos), signatureTemplate);
    let expected = new BigInteger(rusha.digest(data), 16);
    return (sha1.compareTo(expected) == 0);
  }
  catch (e)
  {
    console.warn("Invalid encrypted signature: " + e);
    return false;
  }
}
exports.verifySignature = verifySignature;


/***/ }),
/* 31 */
/***/ (function(module, exports) {

/*
 * Copyright (c) 2003-2005  Tom Wu
 * All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY
 * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.
 *
 * IN NO EVENT SHALL TOM WU BE LIABLE FOR ANY SPECIAL, INCIDENTAL,
 * INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER
 * RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER OR NOT ADVISED OF
 * THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF LIABILITY, ARISING OUT
 * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * In addition, the following condition applies:
 *
 * All redistributions must retain an intact copy of this copyright notice
 * and disclaimer.
 */

// Basic JavaScript BN library - subset useful for RSA encryption.

// Bits per digit
var dbits;

// JavaScript engine analysis
var canary = 0xdeadbeefcafe;
var j_lm = ((canary&0xffffff)==0xefcafe);

// (public) Constructor
function BigInteger(a,b,c) {
  if(a != null)
    if("number" == typeof a) this.fromNumber(a,b,c);
    else if(b == null && "string" != typeof a) this.fromString(a,256);
    else this.fromString(a,b);
}
exports.BigInteger = BigInteger;

// return new, unset BigInteger
function nbi() { return new BigInteger(null); }

// am: Compute w_j += (x*this_i), propagate carries,
// c is initial carry, returns final carry.
// c < 3*dvalue, x < 2*dvalue, this_i < dvalue
// We need to select the fastest one that works in this environment.

// am1: use a single mult and divide to get the high bits,
// max digit bits should be 26 because
// max internal value = 2*dvalue^2-2*dvalue (< 2^53)
function am1(i,x,w,j,c,n) {
  while(--n >= 0) {
    var v = x*this[i++]+w[j]+c;
    c = Math.floor(v/0x4000000);
    w[j++] = v&0x3ffffff;
  }
  return c;
}
// am2 avoids a big mult-and-extract completely.
// Max digit bits should be <= 30 because we do bitwise ops
// on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
function am2(i,x,w,j,c,n) {
  var xl = x&0x7fff, xh = x>>15;
  while(--n >= 0) {
    var l = this[i]&0x7fff;
    var h = this[i++]>>15;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
    c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
    w[j++] = l&0x3fffffff;
  }
  return c;
}
// Alternately, set max digit bits to 28 since some
// browsers slow down when dealing with 32-bit numbers.
function am3(i,x,w,j,c,n) {
  var xl = x&0x3fff, xh = x>>14;
  while(--n >= 0) {
    var l = this[i]&0x3fff;
    var h = this[i++]>>14;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x3fff)<<14)+w[j]+c;
    c = (l>>28)+(m>>14)+xh*h;
    w[j++] = l&0xfffffff;
  }
  return c;
}
if(j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
  BigInteger.prototype.am = am2;
  dbits = 30;
}
else if(j_lm && (navigator.appName != "Netscape")) {
  BigInteger.prototype.am = am1;
  dbits = 26;
}
else { // Mozilla/Netscape seems to prefer am3
  BigInteger.prototype.am = am3;
  dbits = 28;
}

BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = ((1<<dbits)-1);
BigInteger.prototype.DV = (1<<dbits);

var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2,BI_FP);
BigInteger.prototype.F1 = BI_FP-dbits;
BigInteger.prototype.F2 = 2*dbits-BI_FP;

// Digit conversions
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr,vv;
rr = "0".charCodeAt(0);
for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
rr = "a".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
rr = "A".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

function int2char(n) { return BI_RM.charAt(n); }
function intAt(s,i) {
  var c = BI_RC[s.charCodeAt(i)];
  return (c==null)?-1:c;
}

// (protected) copy this to r
function bnpCopyTo(r) {
  for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
  r.t = this.t;
  r.s = this.s;
}

// (protected) set from integer value x, -DV <= x < DV
function bnpFromInt(x) {
  this.t = 1;
  this.s = (x<0)?-1:0;
  if(x > 0) this[0] = x;
  else if(x < -1) this[0] = x+DV;
  else this.t = 0;
}

// return bigint initialized to value
function nbv(i) { var r = nbi(); r.fromInt(i); return r; }

// (protected) set from string and radix
function bnpFromString(s,b) {
  var k;
  if(b == 16) k = 4;
  else if(b == 8) k = 3;
  else if(b == 256) k = 8; // byte array
  else if(b == 2) k = 1;
  else if(b == 32) k = 5;
  else if(b == 4) k = 2;
  else { this.fromRadix(s,b); return; }
  this.t = 0;
  this.s = 0;
  var i = s.length, mi = false, sh = 0;
  while(--i >= 0) {
    var x = (k==8)?s.charCodeAt(i)&0xff:intAt(s,i);   /** MODIFIED **/
    if(x < 0) {
      if(s.charAt(i) == "-") mi = true;
      continue;
    }
    mi = false;
    if(sh == 0)
      this[this.t++] = x;
    else if(sh+k > this.DB) {
      this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
      this[this.t++] = (x>>(this.DB-sh));
    }
    else
      this[this.t-1] |= x<<sh;
    sh += k;
    if(sh >= this.DB) sh -= this.DB;
  }
  if(k == 8 && (s[0]&0x80) != 0) {
    this.s = -1;
    if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
  }
  this.clamp();
  if(mi) BigInteger.ZERO.subTo(this,this);
}

// (protected) clamp off excess high words
function bnpClamp() {
  var c = this.s&this.DM;
  while(this.t > 0 && this[this.t-1] == c) --this.t;
}

// (public) return string representation in given radix
function bnToString(b) {
  if(this.s < 0) return "-"+this.negate().toString(b);
  var k;
  if(b == 16) k = 4;
  else if(b == 8) k = 3;
  else if(b == 256) k = 8; // byte array      /** MODIFIED **/
  else if(b == 2) k = 1;
  else if(b == 32) k = 5;
  else if(b == 4) k = 2;
  else return this.toRadix(b);
  var km = (1<<k)-1, d, m = false, r = "", i = this.t;
  var p = this.DB-(i*this.DB)%k;
  if(i-- > 0) {
    if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = (k==8)?String.fromCharCode(d):int2char(d); }   /** MODIFIED **/
    while(i >= 0) {
      if(p < k) {
        d = (this[i]&((1<<p)-1))<<(k-p);
        d |= this[--i]>>(p+=this.DB-k);
      }
      else {
        d = (this[i]>>(p-=k))&km;
        if(p <= 0) { p += this.DB; --i; }
      }
      if(d > 0) m = true;
      if(m) r += (k==8)?String.fromCharCode(d):int2char(d);    /** MODIFIED **/
    }
  }
  return m?r:"0";
}

// (public) -this
function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }

// (public) |this|
function bnAbs() { return (this.s<0)?this.negate():this; }

// (public) return + if this > a, - if this < a, 0 if equal
function bnCompareTo(a) {
  var r = this.s-a.s;
  if(r != 0) return r;
  var i = this.t;
  r = i-a.t;
  if(r != 0) return r;
  while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
  return 0;
}

// returns bit length of the integer x
function nbits(x) {
  var r = 1, t;
  if((t=x>>>16) != 0) { x = t; r += 16; }
  if((t=x>>8) != 0) { x = t; r += 8; }
  if((t=x>>4) != 0) { x = t; r += 4; }
  if((t=x>>2) != 0) { x = t; r += 2; }
  if((t=x>>1) != 0) { x = t; r += 1; }
  return r;
}

// (public) return the number of bits in "this"
function bnBitLength() {
  if(this.t <= 0) return 0;
  return this.DB*(this.t-1)+nbits(this[this.t-1]^(this.s&this.DM));
}

// (protected) r = this << n*DB
function bnpDLShiftTo(n,r) {
  var i;
  for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
  for(i = n-1; i >= 0; --i) r[i] = 0;
  r.t = this.t+n;
  r.s = this.s;
}

// (protected) r = this >> n*DB
function bnpDRShiftTo(n,r) {
  for(var i = n; i < this.t; ++i) r[i-n] = this[i];
  r.t = Math.max(this.t-n,0);
  r.s = this.s;
}

// (protected) r = this << n
function bnpLShiftTo(n,r) {
  var bs = n%this.DB;
  var cbs = this.DB-bs;
  var bm = (1<<cbs)-1;
  var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
  for(i = this.t-1; i >= 0; --i) {
    r[i+ds+1] = (this[i]>>cbs)|c;
    c = (this[i]&bm)<<bs;
  }
  for(i = ds-1; i >= 0; --i) r[i] = 0;
  r[ds] = c;
  r.t = this.t+ds+1;
  r.s = this.s;
  r.clamp();
}

// (protected) r = this >> n
function bnpRShiftTo(n,r) {
  r.s = this.s;
  var ds = Math.floor(n/this.DB);
  if(ds >= this.t) { r.t = 0; return; }
  var bs = n%this.DB;
  var cbs = this.DB-bs;
  var bm = (1<<bs)-1;
  r[0] = this[ds]>>bs;
  for(var i = ds+1; i < this.t; ++i) {
    r[i-ds-1] |= (this[i]&bm)<<cbs;
    r[i-ds] = this[i]>>bs;
  }
  if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
  r.t = this.t-ds;
  r.clamp();
}

// (protected) r = this - a
function bnpSubTo(a,r) {
  var i = 0, c = 0, m = Math.min(a.t,this.t);
  while(i < m) {
    c += this[i]-a[i];
    r[i++] = c&this.DM;
    c >>= this.DB;
  }
  if(a.t < this.t) {
    c -= a.s;
    while(i < this.t) {
      c += this[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c += this.s;
  }
  else {
    c += this.s;
    while(i < a.t) {
      c -= a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    c -= a.s;
  }
  r.s = (c<0)?-1:0;
  if(c < -1) r[i++] = this.DV+c;
  else if(c > 0) r[i++] = c;
  r.t = i;
  r.clamp();
}

// (protected) r = this * a, r != this,a (HAC 14.12)
// "this" should be the larger one if appropriate.
function bnpMultiplyTo(a,r) {
  var x = this.abs(), y = a.abs();
  var i = x.t;
  r.t = i+y.t;
  while(--i >= 0) r[i] = 0;
  for(i = 0; i < y.t; ++i) r[i+x.t] = x.am(0,y[i],r,i,0,x.t);
  r.s = 0;
  r.clamp();
  if(this.s != a.s) BigInteger.ZERO.subTo(r,r);
}

// (protected) r = this^2, r != this (HAC 14.16)
function bnpSquareTo(r) {
  var x = this.abs();
  var i = r.t = 2*x.t;
  while(--i >= 0) r[i] = 0;
  for(i = 0; i < x.t-1; ++i) {
    var c = x.am(i,x[i],r,2*i,0,1);
    if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1)) >= x.DV) {
      r[i+x.t] -= x.DV;
      r[i+x.t+1] = 1;
    }
  }
  if(r.t > 0) r[r.t-1] += x.am(i,x[i],r,2*i,0,1);
  r.s = 0;
  r.clamp();
}

// (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
// r != q, this != m.  q or r may be null.
function bnpDivRemTo(m,q,r) {
  var pm = m.abs();
  if(pm.t <= 0) return;
  var pt = this.abs();
  if(pt.t < pm.t) {
    if(q != null) q.fromInt(0);
    if(r != null) this.copyTo(r);
    return;
  }
  if(r == null) r = nbi();
  var y = nbi(), ts = this.s, ms = m.s;
  var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
  if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
  else { pm.copyTo(y); pt.copyTo(r); }
  var ys = y.t;
  var y0 = y[ys-1];
  if(y0 == 0) return;
  var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
  var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
  var i = r.t, j = i-ys, t = (q==null)?nbi():q;
  y.dlShiftTo(j,t);
  if(r.compareTo(t) >= 0) {
    r[r.t++] = 1;
    r.subTo(t,r);
  }
  BigInteger.ONE.dlShiftTo(ys,t);
  t.subTo(y,y);	// "negative" y so we can replace sub with am later
  while(y.t < ys) y[y.t++] = 0;
  while(--j >= 0) {
    // Estimate quotient digit
    var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
    if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
      y.dlShiftTo(j,t);
      r.subTo(t,r);
      while(r[i] < --qd) r.subTo(t,r);
    }
  }
  if(q != null) {
    r.drShiftTo(ys,q);
    if(ts != ms) BigInteger.ZERO.subTo(q,q);
  }
  r.t = ys;
  r.clamp();
  if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
  if(ts < 0) BigInteger.ZERO.subTo(r,r);
}

// (public) this mod a
function bnMod(a) {
  var r = nbi();
  this.abs().divRemTo(a,null,r);
  if(this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r,r);
  return r;
}

// Modular reduction using "classic" algorithm
function Classic(m) { this.m = m; }
function cConvert(x) {
  if(x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
  else return x;
}
function cRevert(x) { return x; }
function cReduce(x) { x.divRemTo(this.m,null,x); }
function cMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
function cSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;

// (protected) return "-1/this % 2^DB"; useful for Mont. reduction
// justification:
//         xy == 1 (mod m)
//         xy =  1+km
//   xy(2-xy) = (1+km)(1-km)
// x[y(2-xy)] = 1-k^2m^2
// x[y(2-xy)] == 1 (mod m^2)
// if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
// should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
// JS multiply "overflows" differently from C/C++, so care is needed here.
function bnpInvDigit() {
  if(this.t < 1) return 0;
  var x = this[0];
  if((x&1) == 0) return 0;
  var y = x&3;		// y == 1/x mod 2^2
  y = (y*(2-(x&0xf)*y))&0xf;	// y == 1/x mod 2^4
  y = (y*(2-(x&0xff)*y))&0xff;	// y == 1/x mod 2^8
  y = (y*(2-(((x&0xffff)*y)&0xffff)))&0xffff;	// y == 1/x mod 2^16
  // last step - calculate inverse mod DV directly;
  // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
  y = (y*(2-x*y%this.DV))%this.DV;		// y == 1/x mod 2^dbits
  // we really want the negative inverse, and -DV < y < DV
  return (y>0)?this.DV-y:-y;
}

// Montgomery reduction
function Montgomery(m) {
  this.m = m;
  this.mp = m.invDigit();
  this.mpl = this.mp&0x7fff;
  this.mph = this.mp>>15;
  this.um = (1<<(m.DB-15))-1;
  this.mt2 = 2*m.t;
}

// xR mod m
function montConvert(x) {
  var r = nbi();
  x.abs().dlShiftTo(this.m.t,r);
  r.divRemTo(this.m,null,r);
  if(x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r,r);
  return r;
}

// x/R mod m
function montRevert(x) {
  var r = nbi();
  x.copyTo(r);
  this.reduce(r);
  return r;
}

// x = x/R mod m (HAC 14.32)
function montReduce(x) {
  while(x.t <= this.mt2)	// pad x so am has enough room later
    x[x.t++] = 0;
  for(var i = 0; i < this.m.t; ++i) {
    // faster way of calculating u0 = x[i]*mp mod DV
    var j = x[i]&0x7fff;
    var u0 = (j*this.mpl+(((j*this.mph+(x[i]>>15)*this.mpl)&this.um)<<15))&x.DM;
    // use am to combine the multiply-shift-add into one call
    j = i+this.m.t;
    x[j] += this.m.am(0,u0,x,i,0,this.m.t);
    // propagate carry
    while(x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
  }
  x.clamp();
  x.drShiftTo(this.m.t,x);
  if(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
}

// r = "x^2/R mod m"; x != r
function montSqrTo(x,r) { x.squareTo(r); this.reduce(r); }

// r = "xy/R mod m"; x,y != r
function montMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }

Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;

// (protected) true iff this is even
function bnpIsEven() { return ((this.t>0)?(this[0]&1):this.s) == 0; }

// (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
function bnpExp(e,z) {
  if(e > 0xffffffff || e < 1) return BigInteger.ONE;
  var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e)-1;
  g.copyTo(r);
  while(--i >= 0) {
    z.sqrTo(r,r2);
    if((e&(1<<i)) > 0) z.mulTo(r2,g,r);
    else { var t = r; r = r2; r2 = t; }
  }
  return z.revert(r);
}

// (public) this^e % m, 0 <= e < 2^32
function bnModPowInt(e,m) {
  var z;
  if(e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
  return this.exp(e,z);
}

// protected
BigInteger.prototype.copyTo = bnpCopyTo;
BigInteger.prototype.fromInt = bnpFromInt;
BigInteger.prototype.fromString = bnpFromString;
BigInteger.prototype.clamp = bnpClamp;
BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
BigInteger.prototype.drShiftTo = bnpDRShiftTo;
BigInteger.prototype.lShiftTo = bnpLShiftTo;
BigInteger.prototype.rShiftTo = bnpRShiftTo;
BigInteger.prototype.subTo = bnpSubTo;
BigInteger.prototype.multiplyTo = bnpMultiplyTo;
BigInteger.prototype.squareTo = bnpSquareTo;
BigInteger.prototype.divRemTo = bnpDivRemTo;
BigInteger.prototype.invDigit = bnpInvDigit;
BigInteger.prototype.isEven = bnpIsEven;
BigInteger.prototype.exp = bnpExp;

// public
BigInteger.prototype.toString = bnToString;
BigInteger.prototype.negate = bnNegate;
BigInteger.prototype.abs = bnAbs;
BigInteger.prototype.compareTo = bnCompareTo;
BigInteger.prototype.bitLength = bnBitLength;
BigInteger.prototype.mod = bnMod;
BigInteger.prototype.modPowInt = bnModPowInt;

// "constants"
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);


/***/ }),
/* 32 */
/***/ (function(module, exports, __webpack_require__) {

(function () {
    var /*
 * Rusha, a JavaScript implementation of the Secure Hash Algorithm, SHA-1,
 * as defined in FIPS PUB 180-1, tuned for high performance with large inputs.
 * (http://github.com/srijs/rusha)
 *
 * Inspired by Paul Johnstons implementation (http://pajhome.org.uk/crypt/md5).
 *
 * Copyright (c) 2013 Sam Rijs (http://awesam.de).
 * Released under the terms of the MIT license as follows:
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
    util = {
        getDataType: function (data) {
            if (typeof data === 'string') {
                return 'string';
            }
            if (data instanceof Array) {
                return 'array';
            }
            if (typeof global !== 'undefined' && global.Buffer && global.Buffer.isBuffer(data)) {
                return 'buffer';
            }
            if (data instanceof ArrayBuffer) {
                return 'arraybuffer';
            }
            if (data.buffer instanceof ArrayBuffer) {
                return 'view';
            }
            if (data instanceof Blob) {
                return 'blob';
            }
            throw new Error('Unsupported data type.');
        }
    };
    function Rusha(chunkSize) {
        'use strict';
        var // Private object structure.
        self$2 = { fill: 0 };
        var // Calculate the length of buffer that the sha1 routine uses
        // including the padding.
        padlen = function (len) {
            for (len += 9; len % 64 > 0; len += 1);
            return len;
        };
        var padZeroes = function (bin, len) {
            for (var i$2 = len >> 2; i$2 < bin.length; i$2++)
                bin[i$2] = 0;
        };
        var padData = function (bin, chunkLen, msgLen) {
            bin[chunkLen >> 2] |= 128 << 24 - (chunkLen % 4 << 3);
            // To support msgLen >= 2 GiB, use a float division when computing the
            // high 32-bits of the big-endian message length in bits.
            bin[((chunkLen >> 2) + 2 & ~15) + 14] = msgLen / (1 << 29) | 0;
            bin[((chunkLen >> 2) + 2 & ~15) + 15] = msgLen << 3;
        };
        var // Convert a binary string and write it to the heap.
        // A binary string is expected to only contain char codes < 256.
        convStr = function (H8, H32, start, len, off) {
            var str = this, i$2, om = off % 4, lm = len % 4, j = len - lm;
            if (j > 0) {
                switch (om) {
                case 0:
                    H8[off + 3 | 0] = str.charCodeAt(start);
                case 1:
                    H8[off + 2 | 0] = str.charCodeAt(start + 1);
                case 2:
                    H8[off + 1 | 0] = str.charCodeAt(start + 2);
                case 3:
                    H8[off | 0] = str.charCodeAt(start + 3);
                }
            }
            for (i$2 = om; i$2 < j; i$2 = i$2 + 4 | 0) {
                H32[off + i$2 >> 2] = str.charCodeAt(start + i$2) << 24 | str.charCodeAt(start + i$2 + 1) << 16 | str.charCodeAt(start + i$2 + 2) << 8 | str.charCodeAt(start + i$2 + 3);
            }
            switch (lm) {
            case 3:
                H8[off + j + 1 | 0] = str.charCodeAt(start + j + 2);
            case 2:
                H8[off + j + 2 | 0] = str.charCodeAt(start + j + 1);
            case 1:
                H8[off + j + 3 | 0] = str.charCodeAt(start + j);
            }
        };
        var // Convert a buffer or array and write it to the heap.
        // The buffer or array is expected to only contain elements < 256.
        convBuf = function (H8, H32, start, len, off) {
            var buf = this, i$2, om = off % 4, lm = len % 4, j = len - lm;
            if (j > 0) {
                switch (om) {
                case 0:
                    H8[off + 3 | 0] = buf[start];
                case 1:
                    H8[off + 2 | 0] = buf[start + 1];
                case 2:
                    H8[off + 1 | 0] = buf[start + 2];
                case 3:
                    H8[off | 0] = buf[start + 3];
                }
            }
            for (i$2 = 4 - om; i$2 < j; i$2 = i$2 += 4 | 0) {
                H32[off + i$2 >> 2] = buf[start + i$2] << 24 | buf[start + i$2 + 1] << 16 | buf[start + i$2 + 2] << 8 | buf[start + i$2 + 3];
            }
            switch (lm) {
            case 3:
                H8[off + j + 1 | 0] = buf[start + j + 2];
            case 2:
                H8[off + j + 2 | 0] = buf[start + j + 1];
            case 1:
                H8[off + j + 3 | 0] = buf[start + j];
            }
        };
        var convBlob = function (H8, H32, start, len, off) {
            var blob = this, i$2, om = off % 4, lm = len % 4, j = len - lm;
            var buf = new Uint8Array(reader.readAsArrayBuffer(blob.slice(start, start + len)));
            if (j > 0) {
                switch (om) {
                case 0:
                    H8[off + 3 | 0] = buf[0];
                case 1:
                    H8[off + 2 | 0] = buf[1];
                case 2:
                    H8[off + 1 | 0] = buf[2];
                case 3:
                    H8[off | 0] = buf[3];
                }
            }
            for (i$2 = 4 - om; i$2 < j; i$2 = i$2 += 4 | 0) {
                H32[off + i$2 >> 2] = buf[i$2] << 24 | buf[i$2 + 1] << 16 | buf[i$2 + 2] << 8 | buf[i$2 + 3];
            }
            switch (lm) {
            case 3:
                H8[off + j + 1 | 0] = buf[j + 2];
            case 2:
                H8[off + j + 2 | 0] = buf[j + 1];
            case 1:
                H8[off + j + 3 | 0] = buf[j];
            }
        };
        var convFn = function (data) {
            switch (util.getDataType(data)) {
            case 'string':
                return convStr.bind(data);
            case 'array':
                return convBuf.bind(data);
            case 'buffer':
                return convBuf.bind(data);
            case 'arraybuffer':
                return convBuf.bind(new Uint8Array(data));
            case 'view':
                return convBuf.bind(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            case 'blob':
                return convBlob.bind(data);
            }
        };
        var slice = function (data, offset) {
            switch (util.getDataType(data)) {
            case 'string':
                return data.slice(offset);
            case 'array':
                return data.slice(offset);
            case 'buffer':
                return data.slice(offset);
            case 'arraybuffer':
                return data.slice(offset);
            case 'view':
                return data.buffer.slice(offset);
            }
        };
        var // Precompute 00 - ff strings
        precomputedHex = new Array(256);
        for (var i = 0; i < 256; i++) {
            precomputedHex[i] = (i < 16 ? '0' : '') + i.toString(16);
        }
        var // Convert an ArrayBuffer into its hexadecimal string representation.
        hex = function (arrayBuffer) {
            var binarray = new Uint8Array(arrayBuffer);
            var res = new Array(arrayBuffer.byteLength);
            for (var i$2 = 0; i$2 < res.length; i$2++) {
                res[i$2] = precomputedHex[binarray[i$2]];
            }
            return res.join('');
        };
        var ceilHeapSize = function (v) {
            // The asm.js spec says:
            // The heap object's byteLength must be either
            // 2^n for n in [12, 24) or 2^24 * n for n ≥ 1.
            // Also, byteLengths smaller than 2^16 are deprecated.
            var p;
            if (// If v is smaller than 2^16, the smallest possible solution
                // is 2^16.
                v <= 65536)
                return 65536;
            if (// If v < 2^24, we round up to 2^n,
                // otherwise we round up to 2^24 * n.
                v < 16777216) {
                for (p = 1; p < v; p = p << 1);
            } else {
                for (p = 16777216; p < v; p += 16777216);
            }
            return p;
        };
        var // Initialize the internal data structures to a new capacity.
        init = function (size) {
            if (size % 64 > 0) {
                throw new Error('Chunk size must be a multiple of 128 bit');
            }
            self$2.maxChunkLen = size;
            self$2.padMaxChunkLen = padlen(size);
            // The size of the heap is the sum of:
            // 1. The padded input message size
            // 2. The extended space the algorithm needs (320 byte)
            // 3. The 160 bit state the algoritm uses
            self$2.heap = new ArrayBuffer(ceilHeapSize(self$2.padMaxChunkLen + 320 + 20));
            self$2.h32 = new Int32Array(self$2.heap);
            self$2.h8 = new Int8Array(self$2.heap);
            self$2.core = new Rusha._core({
                Int32Array: Int32Array,
                DataView: DataView
            }, {}, self$2.heap);
            self$2.buffer = null;
        };
        // Iinitializethe datastructures according
        // to a chunk siyze.
        init(chunkSize || 64 * 1024);
        var initState = function (heap, padMsgLen) {
            var io = new Int32Array(heap, padMsgLen + 320, 5);
            io[0] = 1732584193;
            io[1] = -271733879;
            io[2] = -1732584194;
            io[3] = 271733878;
            io[4] = -1009589776;
        };
        var padChunk = function (chunkLen, msgLen) {
            var padChunkLen = padlen(chunkLen);
            var view = new Int32Array(self$2.heap, 0, padChunkLen >> 2);
            padZeroes(view, chunkLen);
            padData(view, chunkLen, msgLen);
            return padChunkLen;
        };
        var // Write data to the heap.
        write = function (data, chunkOffset, chunkLen) {
            convFn(data)(self$2.h8, self$2.h32, chunkOffset, chunkLen, 0);
        };
        var // Initialize and call the RushaCore,
        // assuming an input buffer of length len * 4.
        coreCall = function (data, chunkOffset, chunkLen, msgLen, finalize) {
            var padChunkLen = chunkLen;
            if (finalize) {
                padChunkLen = padChunk(chunkLen, msgLen);
            }
            write(data, chunkOffset, chunkLen);
            self$2.core.hash(padChunkLen, self$2.padMaxChunkLen);
        };
        var getRawDigest = function (heap, padMaxChunkLen) {
            var io = new Int32Array(heap, padMaxChunkLen + 320, 5);
            var out = new Int32Array(5);
            var arr = new DataView(out.buffer);
            arr.setInt32(0, io[0], false);
            arr.setInt32(4, io[1], false);
            arr.setInt32(8, io[2], false);
            arr.setInt32(12, io[3], false);
            arr.setInt32(16, io[4], false);
            return out;
        };
        var // Calculate the hash digest as an array of 5 32bit integers.
        rawDigest = this.rawDigest = function (str) {
            var msgLen = str.byteLength || str.length || str.size || 0;
            initState(self$2.heap, self$2.padMaxChunkLen);
            var chunkOffset = 0, chunkLen = self$2.maxChunkLen, last;
            for (chunkOffset = 0; msgLen > chunkOffset + chunkLen; chunkOffset += chunkLen) {
                coreCall(str, chunkOffset, chunkLen, msgLen, false);
            }
            coreCall(str, chunkOffset, msgLen - chunkOffset, msgLen, true);
            return getRawDigest(self$2.heap, self$2.padMaxChunkLen);
        };
        // The digest and digestFrom* interface returns the hash digest
        // as a hex string.
        this.digest = this.digestFromString = this.digestFromBuffer = this.digestFromArrayBuffer = function (str) {
            return hex(rawDigest(str).buffer);
        };
    }
    ;
    // The low-level RushCore module provides the heart of Rusha,
    // a high-speed sha1 implementation working on an Int32Array heap.
    // At first glance, the implementation seems complicated, however
    // with the SHA1 spec at hand, it is obvious this almost a textbook
    // implementation that has a few functions hand-inlined and a few loops
    // hand-unrolled.
    Rusha._core = function RushaCore(stdlib, foreign, heap) {
        'use asm';
        var H = new stdlib.Int32Array(heap);
        function hash(k, x) {
            // k in bytes
            k = k | 0;
            x = x | 0;
            var i = 0, j = 0, y0 = 0, z0 = 0, y1 = 0, z1 = 0, y2 = 0, z2 = 0, y3 = 0, z3 = 0, y4 = 0, z4 = 0, t0 = 0, t1 = 0;
            y0 = H[x + 320 >> 2] | 0;
            y1 = H[x + 324 >> 2] | 0;
            y2 = H[x + 328 >> 2] | 0;
            y3 = H[x + 332 >> 2] | 0;
            y4 = H[x + 336 >> 2] | 0;
            for (i = 0; (i | 0) < (k | 0); i = i + 64 | 0) {
                z0 = y0;
                z1 = y1;
                z2 = y2;
                z3 = y3;
                z4 = y4;
                for (j = 0; (j | 0) < 64; j = j + 4 | 0) {
                    t1 = H[i + j >> 2] | 0;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 & y2 | ~y1 & y3) | 0) + ((t1 + y4 | 0) + 1518500249 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[k + j >> 2] = t1;
                }
                for (j = k + 64 | 0; (j | 0) < (k + 80 | 0); j = j + 4 | 0) {
                    t1 = (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) << 1 | (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) >>> 31;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 & y2 | ~y1 & y3) | 0) + ((t1 + y4 | 0) + 1518500249 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[j >> 2] = t1;
                }
                for (j = k + 80 | 0; (j | 0) < (k + 160 | 0); j = j + 4 | 0) {
                    t1 = (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) << 1 | (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) >>> 31;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 ^ y2 ^ y3) | 0) + ((t1 + y4 | 0) + 1859775393 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[j >> 2] = t1;
                }
                for (j = k + 160 | 0; (j | 0) < (k + 240 | 0); j = j + 4 | 0) {
                    t1 = (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) << 1 | (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) >>> 31;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 & y2 | y1 & y3 | y2 & y3) | 0) + ((t1 + y4 | 0) - 1894007588 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[j >> 2] = t1;
                }
                for (j = k + 240 | 0; (j | 0) < (k + 320 | 0); j = j + 4 | 0) {
                    t1 = (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) << 1 | (H[j - 12 >> 2] ^ H[j - 32 >> 2] ^ H[j - 56 >> 2] ^ H[j - 64 >> 2]) >>> 31;
                    t0 = ((y0 << 5 | y0 >>> 27) + (y1 ^ y2 ^ y3) | 0) + ((t1 + y4 | 0) - 899497514 | 0) | 0;
                    y4 = y3;
                    y3 = y2;
                    y2 = y1 << 30 | y1 >>> 2;
                    y1 = y0;
                    y0 = t0;
                    H[j >> 2] = t1;
                }
                y0 = y0 + z0 | 0;
                y1 = y1 + z1 | 0;
                y2 = y2 + z2 | 0;
                y3 = y3 + z3 | 0;
                y4 = y4 + z4 | 0;
            }
            H[x + 320 >> 2] = y0;
            H[x + 324 >> 2] = y1;
            H[x + 328 >> 2] = y2;
            H[x + 332 >> 2] = y3;
            H[x + 336 >> 2] = y4;
        }
        return { hash: hash };
    };
    exports = Rusha;
    if (// If we'e running in Node.JS, export a module.
        true) {
        module.exports = Rusha;
    } else {// If we're running in Adblock Plus, export a module.
        exports = Rusha;
    }
    if (// If we're running in a webworker, accept
        // messages containing a jobid and a buffer
        // or blob object, and return the hash result.
        typeof FileReaderSync !== 'undefined') {
        var reader = new FileReaderSync(), hasher = new Rusha(4 * 1024 * 1024);
        self.onmessage = function onMessage(event) {
            var hash, data = event.data.data;
            try {
                hash = hasher.digest(data);
                self.postMessage({
                    id: event.data.id,
                    hash: hash
                });
            } catch (e) {
                self.postMessage({
                    id: event.data.id,
                    error: e.name
                });
            }
        };
    }
}());


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



/**
 * The version of major updates that the user should be aware of. Should be
 * incremented with every new iteration of the updates page.
 * See also Prefs.last_updates_page_displayed
 *
 * @type {number}
 */
exports.updatesVersion = 1;


/***/ }),
/* 34 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module uninstall */



const info = __webpack_require__(1);
const {isDataCorrupted} = __webpack_require__(14);
const {Prefs} = __webpack_require__(3);
const {Utils} = __webpack_require__(6);

let setUninstallURL =
/**
 * Sets (or updates) the URL that is openend when the extension is uninstalled.
 *
 * Must be called after prefs got initialized and a data corruption
 * if any was detected, as well when notification data change.
 */
exports.setUninstallURL = () =>
{
  let search = [];
  for (let key of ["addonName", "addonVersion", "application",
                   "applicationVersion", "platform", "platformVersion"])
    search.push(key + "=" + encodeURIComponent(info[key]));

  let downlCount = Prefs.notificationdata.downloadCount || 0;

  if (downlCount > 4)
  {
    if (downlCount < 8)
      downlCount = "5-7";
    else if (downlCount < 30)
      downlCount = "8-29";
    else if (downlCount < 90)
      downlCount = "30-89";
    else if (downlCount < 180)
      downlCount = "90-179";
    else
      downlCount = "180+";
  }

  search.push("notificationDownloadCount=" + encodeURIComponent(downlCount));
  search.push("corrupted=" + (isDataCorrupted() ? "1" : "0"));

  browser.runtime.setUninstallURL(Utils.getDocLink("uninstalled") + "&" +
                                  search.join("&"));
};

Prefs.on("notificationdata", setUninstallURL);


/***/ }),
/* 35 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


{
  const {IO} = __webpack_require__(12);
  const info = __webpack_require__(1);
  const {IndexedDBBackup} = __webpack_require__(11);

  const testFileNames = {
    testData: "testData",
    stat: "stat",
    simpleCheck: "simpleCheck",
    write: "writeCheck",
    read: "readCheck",
    readBackup: "readBackup",
    rename: "renameCheck"
  };
  const testData = {
    fileName: "file:" + testFileNames.testData,
    content: [1, 2, 3],
    lastModified: Date.now()
  };

  let _backupName = "test";
  let _storageData = new Map();

  IndexedDBBackup.getBackupData = () =>
  {
    return new Promise((resolve, reject) =>
    {
      if (_storageData.size)
      {
        resolve(_storageData.get(_backupName));
      }
      else
        reject({type: "NoSuchFile"});
    });
  };

  let testEdge = info.platform == "edgehtml" ? QUnit.test : QUnit.skip;

  QUnit.module("Microsoft Edge filter storage", {
    beforeEach(assert)
    {
      prePopulateStorage(assert);
    },
    afterEach(assert)
    {
      _storageData.clear();
      clearStorage(assert);
    }
  });

  testEdge("statFile", assert =>
  {
    const noFileMsg = "returns correct value if file doesn't exist" +
      " and there is no backup";
    const fileExistsMsg = "returns correct value if file exists in indexedDB";

    ok(IO.statFile(testFileNames.simpleCheck) instanceof Promise,
      "returns a promise");

    asyncReadHelper(
      IO.statFile,
      testFileNames.testData,
      {exists: true, lastModified: testData.lastModified},
      fileExistsMsg,
      assert);

    asyncReadHelper(
      IO.statFile,
      testFileNames.simpleCheck,
      {exists: false},
      noFileMsg,
      assert);
  });

  testEdge("restore backup", assert =>
  {
    let backupData = {
      content: ["backup data"],
      lastModified: Date.now()
    };
    let readFromFileMessage = "readFromFile return correct value," +
      " if a data restore is performed";
    _storageData.set(_backupName, backupData);

    asyncReadHelper(
      IO.statFile,
      testFileNames.readBackup,
      {exists: true, lastModified: backupData.lastModified},
      "statFile return correct value, if a data restore is performed",
      assert);

    callsListeners(
      testFileNames.readBackup,
      assert, backupData.content,
      readFromFileMessage);
  });

  testEdge("writeToFile", assert =>
  {
    ok(IO.writeToFile(testFileNames.simpleCheck, ["test"]) instanceof Promise,
      "returns a promise");

    writesCorrectValue(assert);
  });

  function writesCorrectValue(assert)
  {
    const writeCheck = {
      fileName: "file:writeCheck",
      content: [1, 2, 3],
      lastModified: Date.now()
    };
    let done = assert.async();

    IO.writeToFile(testFileNames.write, writeCheck.content)
      .then(() => readFromStorage(writeCheck.fileName))
      .then(result =>
      {
        deepEqual(
          Object.keys(writeCheck),
          Object.keys(result),
          "data is written in the correct format");

        deepEqual(
          writeCheck.content,
          result.content,
          "data has the correct content");
        done();
      });
  }

  testEdge("readFromFile", assert =>
  {
    const noFileMsg = "returns correct value if file doesn't exist" +
      " and there is no backup";
    const fileExistsMsg = "calls listeners with the correct values";

    ok(IO.readFromFile(testFileNames.simpleCheck) instanceof Promise,
    "returns a promise");

    asyncReadHelper(
      IO.readFromFile,
      testFileNames.read,
      {type: "NoSuchFile"},
      noFileMsg,
      assert
    );

    callsListeners(
      testFileNames.testData,
      assert,
      testData.content,
      fileExistsMsg);
  });

  function callsListeners(fileName, assert, expected, message)
  {
    let done = assert.async();
    let called = [];

    IO.readFromFile(fileName, (entry) => called.push(entry))
      .then(() =>
      {
        deepEqual(called, expected, message);
        done();
      });
  }

  testEdge("renameFile", assert =>
  {
    ok(IO.renameFile(testFileNames.simpleCheck) instanceof Promise,
      "returns a promise");

    checkRename(assert);
  });

  function checkRename(assert)
  {
    let done = assert.async();
    const expected = {
      fileName: "file:" + testFileNames.rename,
      content: testData.content,
      lastModified: testData.lastModified
    };

    IO.renameFile(testFileNames.testData, testFileNames.rename)
      .then(() => readFromStorage("file:" + testFileNames.rename))
      .then(result =>
      {
        deepEqual(result, expected, "overrites file");
        done();
      });
  }

  function asyncReadHelper(method, fileName, expectedValue, description, assert)
  {
    let done = assert.async();
    method(fileName)
    .then(result =>
    {
      deepEqual(result, expectedValue, description);
      done();
    })
    .catch(error =>
    {
      deepEqual(error, expectedValue, description);
      done();
    });
  }

  function readFromStorage(fileName)
  {
    return new Promise(resolve =>
    {
      let db;
      let req = indexedDB.open("adblockplus", 1);
      req.onsuccess = (event) =>
      {
        db = event.currentTarget.result;
        let store = db
          .transaction(["file"], "readwrite")
          .objectStore("file");

        store.get(fileName).onsuccess = evt =>
          resolve(evt.currentTarget.result);
      };
    });
  }

  function prePopulateStorage(assert)
  {
    let done = assert.async();
    let db;
    let req = indexedDB.open("adblockplus", 1);

    req.onsuccess = (event) =>
    {
      db = event.currentTarget.result;
      let store = db
        .transaction(["file"], "readwrite")
        .objectStore("file");

      store.put(testData).onsuccess = done;
    };
  }

  function clearStorage(assert)
  {
    let done = assert.async();
    let db;
    let req = indexedDB.open("adblockplus", 1);
    req.onsuccess = event =>
    {
      db = event.currentTarget.result;
      Promise.all(Object.values(testFileNames)
      .map(fileName => new Promise(resolveFile =>
      {
        let store = db
          .transaction(["file"], "readwrite")
          .objectStore("file");

        store.delete("file:" + fileName).onsuccess = resolveFile;
      })))
      .then(() => done());
    };
  }
}



/***/ }),
/* 36 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


{
  const {Filter, ElemHideFilter} =
    __webpack_require__(0);
  const {escapeCSS, quoteCSS} = __webpack_require__(37);

  QUnit.module("CSS escaping");

  test("CSS escaping", () =>
  {
    function testSelector(opts)
    {
      let mustMatch = opts.mustMatch !== false;
      let doc = document.implementation.createHTMLDocument();

      let style = doc.createElement("style");
      doc.documentElement.appendChild(style);
      style.sheet.insertRule(opts.selector + " {}", 0);

      let element;
      try
      {
        element = doc.createElement(opts.tagName || "div");
      }
      catch (e)
      {
        // Some characters we are going to test can not occur in tag names,
        // but we still have to make sure that no exception is thrown when
        // calling .querySelector() and .insertRule()
        element = null;
        mustMatch = false;
      }

      if (element)
      {
        for (let attr in opts.attributes)
          element.setAttribute(attr, opts.attributes[attr]);

        doc.documentElement.appendChild(element);
      }

      let foundElement = doc.querySelector(opts.selector);
      let filter = Filter.fromText("##" + opts.selector);

      if (!(filter instanceof ElemHideFilter))
        ok(false, opts.selector + " (not allowed in elemhide filters)");
      else if (mustMatch)
        equal(foundElement, element, opts.selector);
      else
        ok(true, opts.selector);
    }

    function testEscape(s)
    {
      testSelector({
        selector: escapeCSS(s),
        tagName: s
      });

      testSelector({
        selector: "#" + escapeCSS(s),
        attributes: {id: s}
      });

      testSelector({
        selector: "." + escapeCSS(s),
        attributes: {class: s},

        // Whitespace characters split the class name, hence the selector
        // won't match. But we still have to make sure that no exception
        // is thrown when calling .querySelector() and .insertRule()
        mustMatch: !/\s/.test(s)
      });

      testSelector({
        selector: "[foo=" + quoteCSS(s) + "]",
        attributes: {foo: s}
      });
    }

    for (let i = 1; i < 0x80; i++)
    {
      let chr = String.fromCharCode(i);

      // Make sure that all ASCII characters are correctly escaped.
      testEscape(chr);

      // Some characters are only escaped when in the first positon,
      // so we still have to make sure that everything is correctly escaped
      // in subsequent positions.
      testEscape("x" + chr);

      // Leading dashes must be escaped, when followed by certain characters.
      testEscape("-" + chr);
    }

    // Test some non-ASCII characters. However, those shouldn't
    // require escaping.
    testEscape("\uD83D\uDE3B\u2665\u00E4");
  });
}


/***/ }),
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module filterComposer */



const {defaultMatcher} = __webpack_require__(9);
const {RegExpFilter} = __webpack_require__(0);
const {filterNotifier} = __webpack_require__(2);
const {Prefs} = __webpack_require__(3);
const {extractHostFromFrame, isThirdParty} = __webpack_require__(8);
const {getKey, checkWhitelisted} = __webpack_require__(17);
const {port} = __webpack_require__(10);
const info = __webpack_require__(1);

let readyPages = new ext.PageMap();

/**
 * Checks whether the given page is ready to use the filter composer
 *
 * @param {Page} page
 * @return {boolean}
 */
exports.isPageReady = page =>
{
  return readyPages.has(page);
};

function isValidString(s)
{
  return s && s.indexOf("\0") == -1;
}

function escapeChar(chr)
{
  let code = chr.charCodeAt(0);

  // Control characters and leading digits must be escaped based on
  // their char code in CSS. Moreover, curly brackets aren't allowed
  // in elemhide filters, and therefore must be escaped based on their
  // char code as well.
  if (code <= 0x1F || code == 0x7F || /[\d{}]/.test(chr))
    return "\\" + code.toString(16) + " ";

  return "\\" + chr;
}

let escapeCSS =
/**
 * Escapes a token (e.g. tag, id, class or attribute) to be used in
 * CSS selectors.
 *
 * @param {string} s
 * @return {string}
 * @static
 */
exports.escapeCSS = s =>
{
  return s.replace(/^[\d-]|[^\w\-\u0080-\uFFFF]/g, escapeChar);
};

let quoteCSS =
/**
 * Quotes a string to be used as attribute value in CSS selectors.
 *
 * @param {string} value
 * @return {string}
 * @static
 */
exports.quoteCSS = value =>
{
  return '"' + value.replace(/["\\{}\x00-\x1F\x7F]/g, escapeChar) + '"';
};

function composeFilters(details)
{
  let {page, frame} = details;
  let filters = [];
  let selectors = [];

  if (!checkWhitelisted(page, frame))
  {
    let typeMask = RegExpFilter.typeMap[details.type];
    let docDomain = extractHostFromFrame(frame);
    let specificOnly = checkWhitelisted(page, frame, null,
                                        RegExpFilter.typeMap.GENERICBLOCK);

    // Add a blocking filter for each URL of the element that can be blocked
    for (let url of details.urls)
    {
      let urlObj = new URL(url, details.baseURL);
      let filter = defaultMatcher.whitelist.matchesAny(
        urlObj.href, typeMask, docDomain,
        isThirdParty(urlObj, docDomain),
        getKey(page, frame), specificOnly
      );

      if (!filter)
      {
        let filterText = urlObj.href.replace(/^[\w-]+:\/+(?:www\.)?/, "||");

        if (specificOnly)
          filterText += "$domain=" + docDomain;

        if (!filters.includes(filterText))
          filters.push(filterText);
      }
    }

    // If we couldn't generate any blocking filters, fallback to element hiding
    if (filters.length == 0 && !checkWhitelisted(page, frame, null,
                                                 RegExpFilter.typeMap.ELEMHIDE))
    {
      // Generate CSS selectors based on the element's "id" and
      // "class" attribute.
      if (isValidString(details.id))
        selectors.push("#" + escapeCSS(details.id));

      let classes = details.classes.filter(isValidString);
      if (classes.length > 0)
        selectors.push(classes.map(c => "." + escapeCSS(c)).join(""));

      // If there is a "src" attribute, specifiying a URL that we can't block,
      // generate a CSS selector matching the "src" attribute
      if (isValidString(details.src))
      {
        selectors.push(
          escapeCSS(details.tagName) + "[src=" + quoteCSS(details.src) + "]"
        );
      }

      // As last resort, if there is a "style" attribute, and we
      // couldn't generate any filters so far, generate a CSS selector
      // matching the "style" attribute
      if (isValidString(details.style) && selectors.length == 0 &&
          filters.length == 0)
      {
        selectors.push(
          escapeCSS(details.tagName) + "[style=" + quoteCSS(details.style) + "]"
        );
      }

      // Add an element hiding filter for each generated CSS selector
      for (let selector of selectors)
        filters.push(docDomain.replace(/^www\./, "") + "##" + selector);
    }
  }

  return {filters, selectors};
}

let contextMenuItem = {
  title: browser.i18n.getMessage("block_element"),
  contexts: ["image", "video", "audio"],
  onclick(page)
  {
    page.sendMessage({type: "composer.content.contextMenuClicked"});
  }
};

function updateContextMenu(page, filter)
{
  page.contextMenus.remove(contextMenuItem);

  if (typeof filter == "undefined")
    filter = checkWhitelisted(page);

  // We don't support the filter composer on Firefox for Android, because the
  // user experience on mobile is quite different.
  if (info.application != "fennec" &&
      !filter && Prefs.shouldShowBlockElementMenu && readyPages.has(page))
  {
    page.contextMenus.create(contextMenuItem);
  }
}

filterNotifier.on("page.WhitelistingStateRevalidate", updateContextMenu);

Prefs.on("shouldShowBlockElementMenu", () =>
{
  browser.tabs.query({}, tabs =>
  {
    for (let tab of tabs)
      updateContextMenu(new ext.Page(tab));
  });
});

port.on("composer.isPageReady", (message, sender) =>
{
  return readyPages.has(new ext.Page({id: message.pageId}));
});

port.on("composer.ready", (message, sender) =>
{
  readyPages.set(sender.page, null);
  updateContextMenu(sender.page);
});

port.on("composer.openDialog", (message, sender) =>
{
  return browser.windows.create({
    url: browser.extension.getURL("composer.html"),
    left: 50,
    top: 50,
    width: 420,
    height: 200,
    type: "popup"
  }).then(window =>
  {
    // The windows.create API with versions of Firefox < 52 doesn't seem to
    // populate the tabs property reliably.
    if ("tabs" in window)
      return window;
    return browser.windows.get(window.id, {populate: true});
  }).then(window =>
  {
    let popupPageId = window.tabs[0].id;

    let doInitAttempt = 0;
    let doInit = () =>
    {
      doInitAttempt += 1;
      if (doInitAttempt > 30)
        return;

      browser.tabs.sendMessage(popupPageId, {
        type: "composer.dialog.init",
        sender: sender.page.id,
        filters: message.filters
      }).then(response =>
      {
        // Sometimes sendMessage incorrectly reports a success on Firefox, so
        // we must check the response too.
        if (!response)
          throw new Error();
      }).catch(e =>
      {
        // Firefox sometimes sets the status for a window to "complete" before
        // it is ready to receive messages[1]. As a workaround we'll try again a
        // few times with a second delay.
        // [1] - https://bugzilla.mozilla.org/show_bug.cgi?id=1418655
        setTimeout(doInit, 100);
      });
    };
    if (window.tabs[0].status != "complete")
    {
      let updateListener = (tabId, changeInfo, tab) =>
      {
        if (tabId == popupPageId && changeInfo.status == "complete")
        {
          browser.tabs.onUpdated.removeListener(updateListener);
          doInit();
        }
      };
      browser.tabs.onUpdated.addListener(updateListener);
    }
    else
      doInit();

    let onRemoved = removedTabId =>
    {
      if (removedTabId == popupPageId)
      {
        sender.page.sendMessage({
          type: "composer.content.dialogClosed",
          popupId: popupPageId
        });
        browser.tabs.onRemoved.removeListener(onRemoved);
      }
    };
    browser.tabs.onRemoved.addListener(onRemoved);

    if (info.application == "firefox" && navigator.oscpu.startsWith("Linux"))
    {
      // Work around https://bugzil.la/1408446
      browser.windows.update(window.id, {width: window.width + 1});
    }
    return popupPageId;
  });
});

port.on("composer.getFilters", (message, sender) =>
{
  return composeFilters({
    tagName: message.tagName,
    id: message.id,
    src: message.src,
    style: message.style,
    classes: message.classes,
    urls: message.urls,
    type: message.mediatype,
    baseURL: message.baseURL,
    page: sender.page,
    frame: sender.frame
  });
});

port.on("composer.forward", (msg, sender) =>
{
  let targetPage;
  if (msg.targetPageId)
    targetPage = ext.getPage(msg.targetPageId);
  else
    targetPage = sender.page;
  if (targetPage)
  {
    msg.payload.sender = sender.page.id;
    if (msg.expectsResponse)
      return new Promise(targetPage.sendMessage.bind(targetPage, msg.payload));
    targetPage.sendMessage(msg.payload);
  }
});

ext.pages.onLoading.addListener(page =>
{
  // When tabs start loading we send them a message to ensure that the state
  // of the "block element" tool is reset. This is necessary since Firefox will
  // sometimes cache the state of a tab when the user navigates back / forward,
  // which includes the state of the "block element" tool.
  // Since sending this message will often fail (e.g. for new tabs which have
  // just been opened) we catch and ignore any exception thrown.
  browser.tabs.sendMessage(
    page.id, {type: "composer.content.finished"}
  ).catch(() => {});
});


/***/ }),
/* 38 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


{
  const {parseFilter, parseFilters} = __webpack_require__(39);
  const {BlockingFilter,
         ElemHideFilter,
         CommentFilter} = __webpack_require__(0);

  QUnit.module("Filter validation");

  test("Detecting invalid filters", () =>
  {
    equal(parseFilter("||example.com^$unknown").error.type, "invalid-filter",
          "unknown option");
    equal(parseFilter("[foobar]").error.type, "unexpected-filter-list-header",
          "filter list header");
    equal(parseFilter("##[foo").error.type, "invalid-css-selector",
          "invalid selector");
    ok(
      /\b4\b/.test(parseFilters("!comment\r\n||example.com^\n\n##/").errors[0]),
      "error contains corresponding line number"
    );
  });

  test("Allowing valid filters", () =>
  {
    let text;
    let filter;

    text = "||example.com^";
    ({filter} = parseFilter(text));
    ok(filter instanceof BlockingFilter, "blocking filter parsed");
    equal(filter.text, text, "blocking filter text matches");

    text = '##div:first-child a[src="http://example.com"] > .foo + #bar';
    ({filter} = parseFilter(text));
    ok(filter instanceof ElemHideFilter, "elemhide filter parsed");
    equal(filter.text, text, "elemhide filter text matches");

    text = "! foo bar";
    ({filter} = parseFilter(text));
    ok(filter instanceof CommentFilter, "comment filter parsed");
    equal(filter.text, text, "comment filter text matches");

    equal(parseFilter("").filter, null, "empty filter parsed as 'null'");
  });

  test("Normalizing filters", () =>
  {
    let ws = " \t\r\n";
    let filterText = ws + "@@" + ws + "||" + ws + "example.com" + ws + "^" + ws;
    equal(parseFilter(filterText).filter.text, "@@||example.com^",
          "unnecessary spaces");
    equal(parseFilter(ws).filter, null, "only spaces");
  });

  test("Parsing multiple filters", () =>
  {
    let result = parseFilters("||example.com^\n \n###foobar\r\n! foo bar\n");

    equal(result.errors.length, 0, "no error occurred");
    equal(result.filters.length, 3, "all filters parsed");

    ok(result.filters[0] instanceof BlockingFilter, "1st filter is blocking");
    equal(result.filters[0].text, "||example.com^", "1st filter text matches");

    ok(result.filters[1] instanceof ElemHideFilter, "2nd filter is elemhide");
    equal(result.filters[1].text, "###foobar", "2nd filter text matches");

    ok(result.filters[2] instanceof CommentFilter, "3rd filter is comment");
    equal(result.filters[2].text, "! foo bar", "3rd filter text matches");
  });
}


/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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

/** @module filterValidation */



const {Filter, InvalidFilter, ElemHideBase, ElemHideEmulationFilter,
       ElemHideException} = __webpack_require__(0);

/**
 * An error returned by
 * {@link module:filterValidation.parseFilter parseFilter()} or
 * {@link module:filterValidation.parseFilters parseFilters()}
 * indicating that a given filter cannot be parsed,
 * contains an invalid CSS selector or is a filter list header.
 *
 * @param {string} type See documentation in the constructor below.
 * @param {Object} [details] Contains the "reason" and / or "selector"
 *                           properties.
 * @constructor
 */
function FilterParsingError(type, details)
{
  /**
   * Indicates why the filter is rejected. Possible choices:
   * "invalid-filter", "invalid-css-selector", "unexpected-filter-list-header"
   *
   * @type {string}
   */
  this.type = type;

  if (details)
  {
    if ("reason" in details)
      this.reason = details.reason;
    if ("selector" in details)
      this.selector = details.selector;
  }
}
FilterParsingError.prototype = {
  /**
   * The line number the error occurred on if
   * {@link module:filterValidation.parseFilters parseFilters()}
   * were used. Or null if the error was returned by
   * {@link module:filterValidation.parseFilter parseFilter()}.
   *
   * @type {?number}
   */
  lineno: null,

  /**
   * Returns a detailed translated error message.
   *
   * @return {string}
   */
  toString()
  {
    let message;
    if (this.reason)
      message = browser.i18n.getMessage(this.reason);
    else
    {
      message = browser.i18n.getMessage(
        this.type.replace(/-/g, "_"),
        "selector" in this ? "'" + this.selector + "'" : null
      );
    }

    if (this.lineno)
    {
      message = browser.i18n.getMessage(
        "line", this.lineno.toLocaleString()
      ) + ": " + message;
    }
    return message;
  }
};

function isValidCSSSelector(selector)
{
  let style = document.createElement("style");
  document.documentElement.appendChild(style);
  let {sheet} = style;
  document.documentElement.removeChild(style);

  try
  {
    document.querySelector(selector);
    sheet.insertRule(selector + "{}", 0);
  }
  catch (e)
  {
    return false;
  }
  return true;
}

function isValidFilterSelector(filter)
{
  // Only ElemHideBase has selectors.
  if (!(filter instanceof ElemHideBase))
    return true;

  // We don't check the syntax of ElemHideEmulationFilter yet.
  if (filter instanceof ElemHideEmulationFilter)
    return true;

  // If it is an ElemHideException, and it has an extended CSS
  // selector we don't validate and assume it is valid.
  if (filter instanceof ElemHideException &&
      filter.selector.includes(":-abp-"))
  {
    return true;
  }

  return isValidCSSSelector(filter.selector);
}

/**
 * @typedef ParsedFilter
 * @property {?Filter} [filter]
 *   The parsed filter if it is valid. Or null if the given string is empty.
 * @property {FilterParsingError} [error]
 *   See {@link module:filterValidation~FilterParsingError FilterParsingError}
 */

let parseFilter =
/**
 * Parses and validates a filter given by the user.
 *
 * @param {string}  text
 * @return {ParsedFilter}
 */
exports.parseFilter = text =>
{
  let filter = null;
  text = Filter.normalize(text);

  if (text)
  {
    if (text[0] == "[")
      return {error: new FilterParsingError("unexpected-filter-list-header")};

    filter = Filter.fromText(text);

    if (filter instanceof InvalidFilter)
    {
      return {error: new FilterParsingError("invalid-filter",
                                            {reason: filter.reason})};
    }
    if (!isValidFilterSelector(filter))
    {
      return {error: new FilterParsingError("invalid-css-selector",
                                            {selector: filter.selector})};
    }
  }

  return {filter};
};

/**
 * @typedef ParsedFilters
 * @property {Filter[]} filters
 *   The parsed result without invalid filters.
 * @property {FilterParsingError[]} errors
 *   See {@link module:filterValidation~FilterParsingError FilterParsingError}
 */

/**
 * Parses and validates a newline-separated list of filters given by the user.
 *
 * @param {string}  text
 * @return {ParsedFilters}
 */
exports.parseFilters = text =>
{
  let lines = text.split("\n");
  let filters = [];
  let errors = [];

  for (let i = 0; i < lines.length; i++)
  {
    let {filter, error} = parseFilter(lines[i]);

    if (filter)
      filters.push(filter);

    if (error)
    {
      error.lineno = i + 1;
      errors.push(error);
    }
  }

  return {filters, errors};
};


/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


{
  const {Prefs} = __webpack_require__(3);

  QUnit.module("Preferences", {
    setup()
    {
      this._pbackup = Object.create(null);
      for (let pref in Prefs)
      {
        let value = Prefs[pref];
        this._pbackup[pref] = value;
      }
      Prefs.enabled = true;
    },

    teardown()
    {
      for (let pref in this._pbackup)
        Prefs[pref] = this._pbackup[pref];
    }
  });

  function checkPrefExists(name, expectedValue, description, assert)
  {
    let done = assert.async();
    let key = "pref:" + name;
    browser.storage.local.get(key, items =>
    {
      equal(key in items, expectedValue, description);
      done();
    });
  }

  function checkPref(name, expectedValue, description, assert)
  {
    let done = assert.async();
    let key = "pref:" + name;
    browser.storage.local.get(key, items =>
    {
      deepEqual(items[key], expectedValue, description);
      done();
    });
  }

  test("Numerical pref", assert =>
  {
    Prefs.patternsbackups = 0;
    equal(
      Prefs.patternsbackups, 0,
      "Prefs object returns the correct value after setting pref to " +
      "default value"
    );
    checkPrefExists(
      "patternsbackups", false, "User-defined pref has been removed", assert
    );
    Prefs.patternsbackups = 12;
    equal(
      Prefs.patternsbackups, 12,
      "Prefs object returns the correct value after setting pref to " +
      "non-default value"
    );
    checkPrefExists(
      "patternsbackups", true, "User-defined pref has been created", assert
    );
    checkPref("patternsbackups", 12, "Value has been written", assert);
  });

  test("Boolean pref", assert =>
  {
    Prefs.enabled = true;
    equal(
      Prefs.enabled, true,
      "Prefs object returns the correct value after setting pref to " +
      "default value"
    );
    checkPrefExists("enabled", false, "User-defined pref has been removed",
                    assert);
    Prefs.enabled = false;
    equal(
      Prefs.enabled, false,
      "Prefs object returns the correct value after setting pref to " +
      "non-default value"
    );
    checkPrefExists("enabled", true, "User-defined pref has been created",
                    assert);
    checkPref("enabled", false, "Value has been written", assert);
  });

  test("String pref", assert =>
  {
    let defaultValue = "https://notification.adblockplus.org/notification.json";
    Prefs.notificationurl = defaultValue;
    equal(
      Prefs.notificationurl, defaultValue,
      "Prefs object returns the correct value after setting pref to " +
      "default value"
    );
    checkPrefExists("notificationurl", false,
                    "User-defined pref has been removed", assert);

    let newValue = "https://notification.adblockplus.org/foo\u1234bar.json";
    Prefs.notificationurl = newValue;
    equal(
      Prefs.notificationurl, newValue,
      "Prefs object returns the correct value after setting pref to " +
      "non-default value"
    );
    checkPrefExists("notificationurl", true,
                    "User-defined pref has been created", assert);
    checkPref("notificationurl", newValue, "Value has been written", assert);
  });

  test("Object pref (complete replacement)", assert =>
  {
    Prefs.notificationdata = {};
    deepEqual(
      Prefs.notificationdata, {},
      "Prefs object returns the correct value after setting pref to " +
      "default value"
    );

    let newValue = {foo: 1, bar: "adsf\u1234"};
    Prefs.notificationdata = newValue;
    equal(
      Prefs.notificationdata, newValue,
      "Prefs object returns the correct value after setting pref to " +
      "non-default value"
    );
    checkPrefExists("notificationdata", true,
                    "User-defined pref has been created", assert);
    checkPref("notificationdata", newValue, "Value has been written", assert);
  });

  test("Property-wise modification", assert =>
  {
    Prefs.notificationdata = {};

    Prefs.notificationdata.foo = 1;
    Prefs.notificationdata.bar = 2;
    Prefs.notificationdata = JSON.parse(JSON.stringify(Prefs.notificationdata));
    deepEqual(
      Prefs.notificationdata, {foo: 1, bar: 2},
      "Prefs object returns the correct value after setting pref to " +
      "non-default value"
    );
    checkPrefExists("notificationdata", true,
                    "User-defined pref has been created", assert);
    checkPref("notificationdata", {foo: 1, bar: 2}, "Value has been written",
              assert);

    delete Prefs.notificationdata.foo;
    delete Prefs.notificationdata.bar;
    Prefs.notificationdata = JSON.parse(JSON.stringify(Prefs.notificationdata));
    deepEqual(
      Prefs.notificationdata, {},
      "Prefs object returns the correct value after setting pref to " +
      "default value"
    );
  });
}


/***/ }),
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
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



{
  const {extractHostFromFrame, isThirdParty} = __webpack_require__(8);
  const {platform} = __webpack_require__(1);

  QUnit.module("URL/host tools");

  test("Extracting hostname from frame", () =>
  {
    function testFrameHostname(hierarchy, expectedHostname, message)
    {
      let frame = null;

      for (let url of hierarchy)
        frame = {parent: frame, url: new URL(url)};

      equal(extractHostFromFrame(frame), expectedHostname, message);
    }

    testFrameHostname(["http://example.com/"], "example.com", "single frame");
    testFrameHostname(["http://example.com/", "http://example.org/"],
                      "example.org", "with parent frame");
    testFrameHostname(["http://example.com/", "data:text/plain,foo"],
                      "example.com", "data: URL, hostname in parent");
    testFrameHostname(["http://example.com/", "about:blank", "about:blank"],
                      "example.com", "about:blank, hostname in ancestor");
    testFrameHostname(["about:blank", "about:blank"], "",
                      "about:blank, no hostname");

    // Currently there are two bugs in Microsoft Edge (EdgeHTML 17.17134)
    // that would make this two assertions fail,
    // so for now we are not running them on this platform.
    // See:
    // with punycode: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/18861990/
    // with auth credentials: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8004284/
    if (platform != "edgehtml")
    {
      testFrameHostname(["http://xn--f-1gaa.com/"], "xn--f-1gaa.com",
                        "with punycode");
      testFrameHostname(["http://user:password@example.com/"], "example.com",
                        "with auth credentials");
    }
  });

  test("Third-party checks", () =>
  {
    function hostnameToURL(hostname)
    {
      return new URL("http://" + hostname);
    }

    function testThirdParty(requestHost, documentHost, expected, message)
    {
      equal(
        isThirdParty(
          hostnameToURL(requestHost),

          // Chrome's URL object normalizes IP addresses. So some test
          // will fail if we don't normalize the document host as well.
          hostnameToURL(documentHost).hostname
        ),
        expected,
        message
      );
    }

    testThirdParty("foo", "foo", false, "same domain isn't third-party");
    testThirdParty("foo", "bar", true, "different domain is third-party");
    testThirdParty("foo.com", "foo.com", false,
                   "same domain with TLD (.com) isn't third-party");
    testThirdParty("foo.com", "bar.com", true,
                   "same TLD (.com) but different domain is third-party");
    testThirdParty("foo.com", "www.foo.com", false,
                   "same domain but differend subdomain isn't third-party");
    testThirdParty("foo.example.com", "bar.example.com", false,
                   "same basedomain (example.com) isn't third-party");
    testThirdParty("foo.uk", "bar.uk", true,
                   "same TLD (.uk) but different domain is third-party");
    testThirdParty("foo.co.uk", "bar.co.uk", true,
                   "same TLD (.co.uk) but different domain is third-party");
    testThirdParty("foo.example.co.uk", "bar.example.co.uk", false,
                   "same basedomain (example.co.uk) isn't third-party");
    testThirdParty("1.2.3.4", "1.2.3.4", false,
                   "same IPv4 address isn't third-party");
    testThirdParty("1.1.1.1", "2.1.1.1", true,
                   "different IPv4 address is third-party");
    testThirdParty("0x01ff0101", "0x01ff0101", false,
                   "same IPv4 hexadecimal address isn't third-party");
    testThirdParty("0x01ff0101", "0x01ff0102", true,
                   "different IPv4 hexadecimal address is third-party");
    testThirdParty(
      "1.0xff.3.4", "1.0xff.3.4", false,
      "same IPv4 address with hexadecimal octet isn't third-party"
    );
    testThirdParty(
      "1.0xff.1.1", "2.0xff.1.1", true,
      "different IPv4 address with hexadecimal octet is third-party"
    );
    testThirdParty(
      "0xff.example.com", "example.com", false,
      "domain starts like a hexadecimal IPv4 address but isn't one"
    );
    testThirdParty(
      "[2001:db8:85a3::8a2e:370:7334]", "[2001:db8:85a3::8a2e:370:7334]", false,
      "same IPv6 address isn't third-party"
    );
    testThirdParty(
      "[2001:db8:85a3::8a2e:370:7334]", "[5001:db8:85a3::8a2e:370:7334]", true,
      "different IPv6 address is third-party"
    );
    testThirdParty(
      "[::ffff:192.0.2.128]", "[::ffff:192.0.2.128]", false,
      "same IPv4-mapped IPv6 address isn't third-party"
    );
    testThirdParty(
      "[::ffff:192.0.2.128]", "[::ffff:192.1.2.128]", true,
      "different IPv4-mapped IPv6 address is third-party"
    );
    testThirdParty("xn--f-1gaa.com", "f\u00f6\u00f6.com", false,
                   "same IDN isn't third-party");
    testThirdParty("example.com..", "example.com....", false,
                   "traling dots are ignored");
  });
}


/***/ })
/******/ ]);
//# sourceMappingURL=tests.js.map