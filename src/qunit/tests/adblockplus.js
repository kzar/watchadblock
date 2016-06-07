/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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

//
// This file has been generated automatically, relevant repositories:
// * https://hg.adblockplus.org/adblockplustests/
// * https://hg.adblockplus.org/jshydra/
//

(function()
{
  module("Domain restrictions",
  {
    setup: prepareFilterComponents,
    teardown: restoreFilterComponents
  });

  function testActive(text, domain, expectedActive, expectedOnlyDomain)
  {
    var filter = Filter.fromText(text);
    equal(filter.isActiveOnDomain(domain), expectedActive, text + " active on " + domain);
    equal(filter.isActiveOnlyOnDomain(domain), expectedOnlyDomain, text + " only active on " + domain);
  }
  test("Unrestricted blocking filters", function()
  {
    testActive("foo", null, true, false);
    testActive("foo", "com", true, false);
    testActive("foo", "example.com", true, false);
    testActive("foo", "example.com.", true, false);
    testActive("foo", "foo.example.com", true, false);
    testActive("foo", "mple.com", true, false);
  });
  test("Unrestricted hiding rules", function()
  {
    testActive("#foo", null, true, false);
    testActive("#foo", "com", true, false);
    testActive("#foo", "example.com", true, false);
    testActive("#foo", "example.com.", true, false);
    testActive("#foo", "foo.example.com", true, false);
    testActive("#foo", "mple.com", true, false);
  });
  test("Domain-restricted blocking filters", function()
  {
    testActive("foo$domain=example.com", null, false, false);
    testActive("foo$domain=example.com", "com", false, true);
    testActive("foo$domain=example.com", "example.com", true, true);
    testActive("foo$domain=example.com", "example.com.", true, true);
    testActive("foo$domain=example.com.", "example.com", true, true);
    testActive("foo$domain=example.com.", "example.com.", true, true);
    testActive("foo$domain=example.com", "foo.example.com", true, false);
    testActive("foo$domain=example.com", "mple.com", false, false);
  });
  test("Domain-restricted hiding rules", function()
  {
    testActive("example.com#foo", null, false, false);
    testActive("example.com#foo", "com", false, true);
    testActive("example.com#foo", "example.com", true, true);
    testActive("example.com#foo", "example.com.", false, false);
    testActive("example.com.#foo", "example.com", false, false);
    testActive("example.com.#foo", "example.com.", true, true);
    testActive("example.com#foo", "foo.example.com", true, false);
    testActive("example.com#foo", "mple.com", false, false);
  });
  test("Blocking filters restricted to domain and its subdomain", function()
  {
    testActive("foo$domain=example.com|foo.example.com", null, false, false);
    testActive("foo$domain=example.com|foo.example.com", "com", false, true);
    testActive("foo$domain=example.com|foo.example.com", "example.com", true, true);
    testActive("foo$domain=example.com|foo.example.com", "example.com.", true, true);
    testActive("foo$domain=example.com|foo.example.com", "foo.example.com", true, false);
    testActive("foo$domain=example.com|foo.example.com", "mple.com", false, false);
  });
  test("Hiding rules restricted to domain and its subdomain", function()
  {
    testActive("example.com,foo.example.com#foo", null, false, false);
    testActive("example.com,foo.example.com#foo", "com", false, true);
    testActive("example.com,foo.example.com#foo", "example.com", true, true);
    testActive("example.com,foo.example.com#foo", "example.com.", false, false);
    testActive("example.com,foo.example.com#foo", "foo.example.com", true, false);
    testActive("example.com,foo.example.com#foo", "mple.com", false, false);
  });
  test("Blocking filters with exception for a subdomain", function()
  {
    testActive("foo$domain=~foo.example.com", null, true, false);
    testActive("foo$domain=~foo.example.com", "com", true, false);
    testActive("foo$domain=~foo.example.com", "example.com", true, false);
    testActive("foo$domain=~foo.example.com", "example.com.", true, false);
    testActive("foo$domain=~foo.example.com", "foo.example.com", false, false);
    testActive("foo$domain=~foo.example.com", "mple.com", true, false);
  });
  test("Hiding rules with exception for a subdomain", function()
  {
    testActive("~foo.example.com#foo", null, true, false);
    testActive("~foo.example.com#foo", "com", true, false);
    testActive("~foo.example.com#foo", "example.com", true, false);
    testActive("~foo.example.com#foo", "example.com.", true, false);
    testActive("~foo.example.com#foo", "foo.example.com", false, false);
    testActive("~foo.example.com#foo", "mple.com", true, false);
  });
  test("Blocking filters for domain but not its subdomain", function()
  {
    testActive("foo$domain=example.com|~foo.example.com", null, false, false);
    testActive("foo$domain=example.com|~foo.example.com", "com", false, true);
    testActive("foo$domain=example.com|~foo.example.com", "example.com", true, true);
    testActive("foo$domain=example.com|~foo.example.com", "example.com.", true, true);
    testActive("foo$domain=example.com|~foo.example.com", "foo.example.com", false, false);
    testActive("foo$domain=example.com|~foo.example.com", "mple.com", false, false);
  });
  test("Hiding rules for domain but not its subdomain", function()
  {
    testActive("example.com,~foo.example.com#foo", null, false, false);
    testActive("example.com,~foo.example.com#foo", "com", false, true);
    testActive("example.com,~foo.example.com#foo", "example.com", true, true);
    testActive("example.com,~foo.example.com#foo", "example.com.", false, false);
    testActive("example.com,~foo.example.com#foo", "foo.example.com", false, false);
    testActive("example.com,~foo.example.com#foo", "mple.com", false, false);
  });
  test("Blocking filters for domain but not its TLD", function()
  {
    testActive("foo$domain=example.com|~com", null, false, false);
    testActive("foo$domain=example.com|~com", "com", false, true);
    testActive("foo$domain=example.com|~com", "example.com", true, true);
    testActive("foo$domain=example.com|~com", "example.com.", true, true);
    testActive("foo$domain=example.com|~com", "foo.example.com", true, false);
    testActive("foo$domain=example.com|~com", "mple.com", false, false);
  });
  test("Hiding rules for domain but not its TLD", function()
  {
    testActive("example.com,~com#foo", null, false, false);
    testActive("example.com,~com#foo", "com", false, true);
    testActive("example.com,~com#foo", "example.com", true, true);
    testActive("example.com,~com#foo", "example.com.", false, false);
    testActive("example.com,~com#foo", "foo.example.com", true, false);
    testActive("example.com,~com#foo", "mple.com", false, false);
  });
  test("Blocking filters restricted to an unrelated domain", function()
  {
    testActive("foo$domain=nnnnnnn.nnn", null, false, false);
    testActive("foo$domain=nnnnnnn.nnn", "com", false, false);
    testActive("foo$domain=nnnnnnn.nnn", "example.com", false, false);
    testActive("foo$domain=nnnnnnn.nnn", "example.com.", false, false);
    testActive("foo$domain=nnnnnnn.nnn", "foo.example.com", false, false);
    testActive("foo$domain=nnnnnnn.nnn", "mple.com", false, false);
  });
  test("Hiding rules restricted to an unrelated domain", function()
  {
    testActive("nnnnnnn.nnn#foo", null, false, false);
    testActive("nnnnnnn.nnn#foo", "com", false, false);
    testActive("nnnnnnn.nnn#foo", "example.com", false, false);
    testActive("nnnnnnn.nnn#foo", "example.com.", false, false);
    testActive("nnnnnnn.nnn#foo", "foo.example.com", false, false);
    testActive("nnnnnnn.nnn#foo", "mple.com", false, false);
  });
})();
(function()
{
  module("Filter classes",
  {
    setup: prepareFilterComponents,
    teardown: restoreFilterComponents
  });

  function serializeFilter(filter)
  {
    var result = [];
    result.push("text=" + filter.text);
    if (filter instanceof InvalidFilter)
    {
      result.push("type=invalid");
      if (filter.reason)
      {
        result.push("hasReason");
      }
    }
    else if (filter instanceof CommentFilter)
    {
      result.push("type=comment");
    }
    else if (filter instanceof ActiveFilter)
    {
      result.push("disabled=" + filter.disabled);
      result.push("lastHit=" + filter.lastHit);
      result.push("hitCount=" + filter.hitCount);
      var domains = [];
      if (filter.domains)
      {
        for (var domain in filter.domains)
        {
          if (domain != "")
          {
            domains.push(filter.domains[domain] ? domain : "~" + domain);
          }
        }
      }
      result.push("domains=" + domains.sort().join("|"));
      if (filter instanceof RegExpFilter)
      {
        result.push("regexp=" + filter.regexp.source);
        result.push("contentType=" + filter.contentType);
        result.push("matchCase=" + filter.matchCase);
        var sitekeys = filter.sitekeys || [];
        result.push("sitekeys=" + sitekeys.slice().sort().join("|"));
        result.push("thirdParty=" + filter.thirdParty);
        if (filter instanceof BlockingFilter)
        {
          result.push("type=filterlist");
          result.push("collapse=" + filter.collapse);
        }
        else if (filter instanceof WhitelistFilter)
        {
          result.push("type=whitelist");
        }
      }
      else if (filter instanceof ElemHideBase)
      {
        if (filter instanceof ElemHideFilter)
        {
          result.push("type=elemhide");
        }
        else if (filter instanceof ElemHideException)
        {
          result.push("type=elemhideexception");
        }
        else if (filter instanceof CSSPropertyFilter)
        {
          result.push("type=cssrule");
          result.push("prefix=" + (filter.selectorPrefix || ""));
          result.push("regexp=" + filter.regexpString);
          result.push("suffix=" + (filter.selectorSuffix || ""));
        }
        result.push("selectorDomain=" + (filter.selectorDomain || ""));
        result.push("selector=" + filter.selector);
      }
    }
    return result;
  }

  function addDefaults(expected)
  {
    var type = null;
    var hasProperty = {};
    for (var _loopIndex0 = 0; _loopIndex0 < expected.length; ++_loopIndex0)
    {
      var entry = expected[_loopIndex0];
      if (/^type=(.*)/.test(entry))
      {
        type = RegExp.$1;
      }
      else if (/^(\w+)/.test(entry))
      {
        hasProperty[RegExp.$1] = true;
      }
    }

    function addProperty(prop, value)
    {
      if (!(prop in hasProperty))
      {
        expected.push(prop + "=" + value);
      }
    }
    if (type == "whitelist" || type == "filterlist" || type == "elemhide" || type == "elemhideexception" || type == "cssrule")
    {
      addProperty("disabled", "false");
      addProperty("lastHit", "0");
      addProperty("hitCount", "0");
    }
    if (type == "whitelist" || type == "filterlist")
    {
      addProperty("contentType", 2147483647 & ~ (RegExpFilter.typeMap.DOCUMENT | RegExpFilter.typeMap.ELEMHIDE | RegExpFilter.typeMap.POPUP | RegExpFilter.typeMap.GENERICHIDE | RegExpFilter.typeMap.GENERICBLOCK));
      addProperty("matchCase", "false");
      addProperty("thirdParty", "null");
      addProperty("domains", "");
      addProperty("sitekeys", "");
    }
    if (type == "filterlist")
    {
      addProperty("collapse", "null");
    }
    if (type == "elemhide" || type == "elemhideexception" || type == "cssrule")
    {
      addProperty("selectorDomain", "");
      addProperty("domains", "");
    }
    if (type == "cssrule")
    {
      addProperty("regexp", "");
      addProperty("prefix", "");
      addProperty("suffix", "");
    }
  }

  function compareFilter(text, expected, postInit)
  {
    addDefaults(expected);
    var filter = Filter.fromText(text);
    if (postInit)
    {
      postInit(filter);
    }
    var result = serializeFilter(filter);
    equal(result.sort().join("\n"), expected.sort().join("\n"), text);
    var filter2;
    var buffer = [];
    filter.serialize(buffer);
    if (buffer.length)
    {
      var map = {
        __proto__: null
      };
      for (var _loopIndex1 = 0; _loopIndex1 < buffer.slice(1).length; ++_loopIndex1)
      {
        var line = buffer.slice(1)[_loopIndex1];
        if (/(.*?)=(.*)/.test(line))
        {
          map[RegExp.$1] = RegExp.$2;
        }
      }
      filter2 = Filter.fromObject(map);
    }
    else
    {
      filter2 = Filter.fromText(filter.text);
    }
    equal(serializeFilter(filter).join("\n"), serializeFilter(filter2).join("\n"), text + " deserialization");
  }
  test("Filter class definitions", function()
  {
    equal(typeof Filter, "function", "typeof Filter");
    equal(typeof InvalidFilter, "function", "typeof InvalidFilter");
    equal(typeof CommentFilter, "function", "typeof CommentFilter");
    equal(typeof ActiveFilter, "function", "typeof ActiveFilter");
    equal(typeof RegExpFilter, "function", "typeof RegExpFilter");
    equal(typeof BlockingFilter, "function", "typeof BlockingFilter");
    equal(typeof WhitelistFilter, "function", "typeof WhitelistFilter");
    equal(typeof ElemHideBase, "function", "typeof ElemHideBase");
    equal(typeof ElemHideFilter, "function", "typeof ElemHideFilter");
    equal(typeof ElemHideException, "function", "typeof ElemHideException");
    equal(typeof CSSPropertyFilter, "function", "typeof CSSPropertyFilter");
  });
  test("Comments", function()
  {
    compareFilter("!asdf", ["type=comment", "text=!asdf"]);
    compareFilter("!foo#bar", ["type=comment", "text=!foo#bar"]);
    compareFilter("!foo##bar", ["type=comment", "text=!foo##bar"]);
  });
  test("Invalid filters", function()
  {
    compareFilter("/??/", ["type=invalid", "text=/??/", "hasReason"]);
    compareFilter("#dd(asd)(ddd)", ["type=invalid", "text=#dd(asd)(ddd)", "hasReason"]);
    {
      var result = Filter.fromText("#dd(asd)(ddd)").reason;
      equal(result, Utils.getString("filter_elemhide_duplicate_id"), "#dd(asd)(ddd).reason");
    }
    compareFilter("#*", ["type=invalid", "text=#*", "hasReason"]);
    {
      var result = Filter.fromText("#*").reason;
      equal(result, Utils.getString("filter_elemhide_nocriteria"), "#*.reason");
    }

    function compareCSSRule(domains)
    {
      var filterText = domains + "##[-abp-properties='abc']";
      compareFilter(filterText, ["type=invalid", "text=" + filterText, "hasReason"]);
      var reason = Filter.fromText(filterText).reason;
      equal(reason, Utils.getString("filter_cssproperty_nodomain"), filterText + ".reason");
    }
    compareCSSRule("");
    compareCSSRule("~foo.com");
    compareCSSRule("~foo.com,~bar.com");
    compareCSSRule("foo");
    compareCSSRule("~foo.com,bar");
  });
  test("Filters with state", function()
  {
    compareFilter("blabla", ["type=filterlist", "text=blabla", "regexp=blabla"]);
    compareFilter("blabla_default", ["type=filterlist", "text=blabla_default", "regexp=blabla_default"], function(filter)
    {
      filter.disabled = false;
      filter.hitCount = 0;
      filter.lastHit = 0;
    });
    compareFilter("blabla_non_default", ["type=filterlist", "text=blabla_non_default", "regexp=blabla_non_default", "disabled=true", "hitCount=12", "lastHit=20"], function(filter)
    {
      filter.disabled = true;
      filter.hitCount = 12;
      filter.lastHit = 20;
    });
  });
  var t = RegExpFilter.typeMap;
  var defaultTypes = 2147483647 & ~ (t.ELEMHIDE | t.DOCUMENT | t.POPUP | t.GENERICHIDE | t.GENERICBLOCK);
  test("Special characters", function()
  {
    compareFilter("/ddd|f?a[s]d/", ["type=filterlist", "text=/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d"]);
    compareFilter("*asdf*d**dd*", ["type=filterlist", "text=*asdf*d**dd*", "regexp=asdf.*d.*dd"]);
    compareFilter("|*asd|f*d**dd*|", ["type=filterlist", "text=|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$"]);
    compareFilter("dd[]{}$%<>&()d", ["type=filterlist", "text=dd[]{}$%<>&()d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\)d"]);
    compareFilter("@@/ddd|f?a[s]d/", ["type=whitelist", "text=@@/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d", "contentType=" + defaultTypes]);
    compareFilter("@@*asdf*d**dd*", ["type=whitelist", "text=@@*asdf*d**dd*", "regexp=asdf.*d.*dd", "contentType=" + defaultTypes]);
    compareFilter("@@|*asd|f*d**dd*|", ["type=whitelist", "text=@@|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$", "contentType=" + defaultTypes]);
    compareFilter("@@dd[]{}$%<>&()d", ["type=whitelist", "text=@@dd[]{}$%<>&()d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\)d", "contentType=" + defaultTypes]);
  });
  test("Filter options", function()
  {
    compareFilter("bla$match-case,script,other,third-party,domain=foo.com,sitekey=foo", ["type=filterlist", "text=bla$match-case,script,other,third-party,domain=foo.com,sitekey=foo", "regexp=bla", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER), "thirdParty=true", "domains=FOO.COM", "sitekeys=FOO"]);
    compareFilter("bla$~match-case,~script,~other,~third-party,domain=~bar.com", ["type=filterlist", "text=bla$~match-case,~script,~other,~third-party,domain=~bar.com", "regexp=bla", "contentType=" + (defaultTypes & ~ (t.SCRIPT | t.OTHER)), "thirdParty=false", "domains=~BAR.COM"]);
    compareFilter("@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com,sitekey=foo|bar", ["type=whitelist", "text=@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com,sitekey=foo|bar", "regexp=bla", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER), "thirdParty=true", "domains=BAR.COM|FOO.COM|~BAR.FOO.COM|~FOO.BAR.COM", "sitekeys=BAR|FOO"]);
    compareFilter("bla$image", ["type=filterlist", "text=bla$image", "regexp=bla", "contentType=" + t.IMAGE]);
    compareFilter("bla$background", ["type=filterlist", "text=bla$background", "regexp=bla", "contentType=" + t.IMAGE]);
    compareFilter("bla$~image", ["type=filterlist", "text=bla$~image", "regexp=bla", "contentType=" + (defaultTypes & ~t.IMAGE)]);
    compareFilter("bla$~background", ["type=filterlist", "text=bla$~background", "regexp=bla", "contentType=" + (defaultTypes & ~t.IMAGE)]);
    compareFilter("@@bla$~script,~other", ["type=whitelist", "text=@@bla$~script,~other", "regexp=bla", "contentType=" + (defaultTypes & ~ (t.SCRIPT | t.OTHER))]);
    compareFilter("@@http://bla$~script,~other", ["type=whitelist", "text=@@http://bla$~script,~other", "regexp=http\\:\\/\\/bla", "contentType=" + (defaultTypes & ~ (t.SCRIPT | t.OTHER))]);
    compareFilter("@@|ftp://bla$~script,~other", ["type=whitelist", "text=@@|ftp://bla$~script,~other", "regexp=^ftp\\:\\/\\/bla", "contentType=" + (defaultTypes & ~ (t.SCRIPT | t.OTHER))]);
    compareFilter("@@bla$~script,~other,document", ["type=whitelist", "text=@@bla$~script,~other,document", "regexp=bla", "contentType=" + (defaultTypes & ~ (t.SCRIPT | t.OTHER) | t.DOCUMENT)]);
    compareFilter("@@bla$~script,~other,~document", ["type=whitelist", "text=@@bla$~script,~other,~document", "regexp=bla", "contentType=" + (defaultTypes & ~ (t.SCRIPT | t.OTHER))]);
    compareFilter("@@bla$document", ["type=whitelist", "text=@@bla$document", "regexp=bla", "contentType=" + t.DOCUMENT]);
    compareFilter("@@bla$~script,~other,elemhide", ["type=whitelist", "text=@@bla$~script,~other,elemhide", "regexp=bla", "contentType=" + (defaultTypes & ~ (t.SCRIPT | t.OTHER) | t.ELEMHIDE)]);
    compareFilter("@@bla$~script,~other,~elemhide", ["type=whitelist", "text=@@bla$~script,~other,~elemhide", "regexp=bla", "contentType=" + (defaultTypes & ~ (t.SCRIPT | t.OTHER))]);
    compareFilter("@@bla$elemhide", ["type=whitelist", "text=@@bla$elemhide", "regexp=bla", "contentType=" + t.ELEMHIDE]);
    compareFilter("@@bla$~script,~other,donottrack", ["type=invalid", "text=@@bla$~script,~other,donottrack", "hasReason"]);
    compareFilter("@@bla$~script,~other,~donottrack", ["type=invalid", "text=@@bla$~script,~other,~donottrack", "hasReason"]);
    compareFilter("@@bla$donottrack", ["type=invalid", "text=@@bla$donottrack", "hasReason"]);
    compareFilter("@@bla$foobar", ["type=invalid", "text=@@bla$foobar", "hasReason"]);
    compareFilter("@@bla$image,foobar", ["type=invalid", "text=@@bla$image,foobar", "hasReason"]);
    compareFilter("@@bla$foobar,image", ["type=invalid", "text=@@bla$foobar,image", "hasReason"]);
  });
  test("Element hiding rules", function()
  {
    compareFilter("#ddd", ["type=elemhide", "text=#ddd", "selector=ddd"]);
    compareFilter("#ddd(fff)", ["type=elemhide", "text=#ddd(fff)", "selector=ddd.fff,ddd#fff"]);
    compareFilter("#ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", ["type=elemhide", "text=#ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", "selector=ddd[foo=\"bar\"][foo2^=\"bar2\"][foo3*=\"bar3\"][foo4$=\"bar4\"]"]);
    compareFilter("#ddd(fff)(foo=bar)", ["type=elemhide", "text=#ddd(fff)(foo=bar)", "selector=ddd.fff[foo=\"bar\"],ddd#fff[foo=\"bar\"]"]);
    compareFilter("#*(fff)", ["type=elemhide", "text=#*(fff)", "selector=.fff,#fff"]);
    compareFilter("#*(foo=bar)", ["type=elemhide", "text=#*(foo=bar)", "selector=[foo=\"bar\"]"]);
    compareFilter("##body > div:first-child", ["type=elemhide", "text=##body > div:first-child", "selector=body > div:first-child"]);
    compareFilter("foo#ddd", ["type=elemhide", "text=foo#ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO"]);
    compareFilter("foo,bar#ddd", ["type=elemhide", "text=foo,bar#ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO"]);
    compareFilter("foo,~bar#ddd", ["type=elemhide", "text=foo,~bar#ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO|~BAR"]);
    compareFilter("foo,~baz,bar#ddd", ["type=elemhide", "text=foo,~baz,bar#ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO|~BAZ"]);
  });
  test("Element hiding exceptions", function()
  {
    compareFilter("#@ddd", ["type=elemhideexception", "text=#@ddd", "selector=ddd"]);
    compareFilter("#@ddd(fff)", ["type=elemhideexception", "text=#@ddd(fff)", "selector=ddd.fff,ddd#fff"]);
    compareFilter("#@ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", ["type=elemhideexception", "text=#@ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", "selector=ddd[foo=\"bar\"][foo2^=\"bar2\"][foo3*=\"bar3\"][foo4$=\"bar4\"]"]);
    compareFilter("#@ddd(fff)(foo=bar)", ["type=elemhideexception", "text=#@ddd(fff)(foo=bar)", "selector=ddd.fff[foo=\"bar\"],ddd#fff[foo=\"bar\"]"]);
    compareFilter("#@*(fff)", ["type=elemhideexception", "text=#@*(fff)", "selector=.fff,#fff"]);
    compareFilter("#@*(foo=bar)", ["type=elemhideexception", "text=#@*(foo=bar)", "selector=[foo=\"bar\"]"]);
    compareFilter("#@#body > div:first-child", ["type=elemhideexception", "text=#@#body > div:first-child", "selector=body > div:first-child"]);
    compareFilter("foo#@ddd", ["type=elemhideexception", "text=foo#@ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO"]);
    compareFilter("foo,bar#@ddd", ["type=elemhideexception", "text=foo,bar#@ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO"]);
    compareFilter("foo,~bar#@ddd", ["type=elemhideexception", "text=foo,~bar#@ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO|~BAR"]);
    compareFilter("foo,~baz,bar#@ddd", ["type=elemhideexception", "text=foo,~baz,bar#@ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO|~BAZ"]);
  });
  test("CSS property filters", function()
  {
    compareFilter("foo.com##[-abp-properties='abc']", ["type=cssrule", "text=foo.com##[-abp-properties='abc']", "selectorDomain=foo.com", "selector=[-abp-properties='abc']", "domains=FOO.COM", "regexp=abc"]);
    compareFilter("foo.com,~bar.com##[-abp-properties='abc']", ["type=cssrule", "text=foo.com,~bar.com##[-abp-properties='abc']", "selectorDomain=foo.com", "selector=[-abp-properties='abc']", "domains=FOO.COM|~BAR.COM", "regexp=abc"]);
    compareFilter("foo.com,~bar##[-abp-properties='abc']", ["type=cssrule", "text=foo.com,~bar##[-abp-properties='abc']", "selectorDomain=foo.com", "selector=[-abp-properties='abc']", "domains=FOO.COM|~BAR", "regexp=abc"]);
    compareFilter("~foo.com,bar.com##[-abp-properties='abc']", ["type=cssrule", "text=~foo.com,bar.com##[-abp-properties='abc']", "selectorDomain=bar.com", "selector=[-abp-properties='abc']", "domains=BAR.COM|~FOO.COM", "regexp=abc"]);
    compareFilter("##[-abp-properties='']", ["type=elemhide", "text=##[-abp-properties='']", "selector=[-abp-properties='']"]);
    compareFilter("foo.com#@#[-abp-properties='abc']", ["type=elemhideexception", "text=foo.com#@#[-abp-properties='abc']", "selectorDomain=foo.com", "selector=[-abp-properties='abc']", "domains=FOO.COM"]);
    compareFilter("foo.com##aaa [-abp-properties='abc'] bbb", ["type=cssrule", "text=foo.com##aaa [-abp-properties='abc'] bbb", "selectorDomain=foo.com", "selector=aaa [-abp-properties='abc'] bbb", "domains=FOO.COM", "prefix=aaa ", "regexp=abc", "suffix= bbb"]);
    compareFilter("foo.com##[-abp-properties='|background-image: url(data:*)']", ["type=cssrule", "text=foo.com##[-abp-properties='|background-image: url(data:*)']", "selectorDomain=foo.com", "selector=[-abp-properties='|background-image: url(data:*)']", "domains=FOO.COM", "regexp=^background\\-image\\:\\ url\\(data\\:.*\\)"]);
  });
})();
(function()
{
  module("Filter notifier",
  {
    setup: prepareFilterComponents,
    teardown: restoreFilterComponents
  });
  var triggeredListeners = [];
  var listeners = [function(action, item)
  {
    return triggeredListeners.push(["listener1", action, item]);
  }, function(action, item)
  {
    return triggeredListeners.push(["listener2", action, item]);
  }, function(action, item)
  {
    return triggeredListeners.push(["listener3", action, item]);
  }];

  function compareListeners(test, list)
  {
    var result1 = triggeredListeners = [];
    FilterNotifier.triggerListeners("foo",
    {
      bar: true
    });
    var result2 = triggeredListeners = [];
    for (var _loopIndex2 = 0; _loopIndex2 < list.length; ++_loopIndex2)
    {
      var observer = list[_loopIndex2];
      observer("foo",
      {
        bar: true
      });
    }
    deepEqual(result1, result2, test);
  }
  test("Adding/removing listeners", function()
  {
    var _tempVar3 = listeners;
    var listener1 = _tempVar3[0];
    var listener2 = _tempVar3[1];
    var listener3 = _tempVar3[2];
    compareListeners("No listeners", []);
    FilterNotifier.addListener(listener1);
    compareListeners("addListener(listener1)", [listener1]);
    FilterNotifier.addListener(listener1);
    compareListeners("addListener(listener1) again", [listener1]);
    FilterNotifier.addListener(listener2);
    compareListeners("addListener(listener2)", [listener1, listener2]);
    FilterNotifier.removeListener(listener1);
    compareListeners("removeListener(listener1)", [listener2]);
    FilterNotifier.removeListener(listener1);
    compareListeners("removeListener(listener1) again", [listener2]);
    FilterNotifier.addListener(listener3);
    compareListeners("addListener(listener3)", [listener2, listener3]);
    FilterNotifier.addListener(listener1);
    compareListeners("addListener(listener1)", [listener2, listener3, listener1]);
    FilterNotifier.removeListener(listener3);
    compareListeners("removeListener(listener3)", [listener2, listener1]);
    FilterNotifier.removeListener(listener1);
    compareListeners("removeListener(listener1)", [listener2]);
    FilterNotifier.removeListener(listener2);
    compareListeners("removeListener(listener2)", []);
  });
  test("Removing listeners while being called", function()
  {
    var listener1 = function()
    {
      listeners[0].apply(this, arguments);
      FilterNotifier.removeListener(listener1);
    };
    var listener2 = listeners[1];
    FilterNotifier.addListener(listener1);
    FilterNotifier.addListener(listener2);
    compareListeners("Initial call", [listener1, listener2]);
    compareListeners("Subsequent calls", [listener2]);
  });
})();
(function()
{
  module("Filter storage",
  {
    setup: function()
    {
      prepareFilterComponents.call(this);
      preparePrefs.call(this);
      Prefs.savestats = true;
    },
    teardown: function()
    {
      restoreFilterComponents.call(this);
      restorePrefs.call(this);
    }
  });

  function compareSubscriptionList(test, list)
  {
    var result = FilterStorage.subscriptions.map(function(subscription)
    {
      return subscription.url;
    });
    var expected = list.map(function(subscription)
    {
      return subscription.url;
    });
    deepEqual(result, expected, test);
  }

  function compareFiltersList(test, list)
  {
    var result = FilterStorage.subscriptions.map(function(subscription)
    {
      return subscription.filters.map(function(filter)
      {
        return filter.text;
      });
    });
    deepEqual(result, list, test);
  }

  function compareFilterSubscriptions(test, filter, list)
  {
    var result = filter.subscriptions.map(function(subscription)
    {
      return subscription.url;
    });
    var expected = list.map(function(subscription)
    {
      return subscription.url;
    });
    deepEqual(result, expected, test);
  }
  test("Adding subscriptions", function()
  {
    var subscription1 = Subscription.fromURL("http://test1/");
    var subscription2 = Subscription.fromURL("http://test2/");
    var changes = [];

    function listener(action, subscription)
    {
      if (action.indexOf("subscription.") == 0)
      {
        changes.push(action + " " + subscription.url);
      }
    }
    FilterNotifier.addListener(listener);
    compareSubscriptionList("Initial state", []);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.addSubscription(subscription1);
    compareSubscriptionList("Regular add", [subscription1]);
    deepEqual(changes, ["subscription.added http://test1/"], "Received changes");
    changes = [];
    FilterStorage.addSubscription(subscription1);
    compareSubscriptionList("Adding already added subscription", [subscription1]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.addSubscription(subscription2, true);
    compareSubscriptionList("Silent add", [subscription1, subscription2]);
    deepEqual(changes, [], "Received changes");
    FilterStorage.removeSubscription(subscription1);
    compareSubscriptionList("Remove", [subscription2]);
    changes = [];
    FilterStorage.addSubscription(subscription1);
    compareSubscriptionList("Re-adding previously removed subscription", [subscription2, subscription1]);
    deepEqual(changes, ["subscription.added http://test1/"], "Received changes");
  });
  test("Removing subscriptions", function()
  {
    var subscription1 = Subscription.fromURL("http://test1/");
    var subscription2 = Subscription.fromURL("http://test2/");
    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);
    var changes = [];

    function listener(action, subscription)
    {
      if (action.indexOf("subscription.") == 0)
      {
        changes.push(action + " " + subscription.url);
      }
    }
    FilterNotifier.addListener(listener);
    compareSubscriptionList("Initial state", [subscription1, subscription2]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.removeSubscription(subscription1);
    compareSubscriptionList("Regular remove", [subscription2]);
    deepEqual(changes, ["subscription.removed http://test1/"], "Received changes");
    changes = [];
    FilterStorage.removeSubscription(subscription1);
    compareSubscriptionList("Removing already removed subscription", [subscription2]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.removeSubscription(subscription2, true);
    compareSubscriptionList("Silent remove", []);
    deepEqual(changes, [], "Received changes");
    FilterStorage.addSubscription(subscription1);
    compareSubscriptionList("Add", [subscription1]);
    changes = [];
    FilterStorage.removeSubscription(subscription1);
    compareSubscriptionList("Re-removing previously added subscription", []);
    deepEqual(changes, ["subscription.removed http://test1/"], "Received changes");
  });
  test("Moving subscriptions", function()
  {
    var subscription1 = Subscription.fromURL("http://test1/");
    var subscription2 = Subscription.fromURL("http://test2/");
    var subscription3 = Subscription.fromURL("http://test3/");
    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);
    FilterStorage.addSubscription(subscription3);
    var changes = [];

    function listener(action, subscription)
    {
      if (action.indexOf("subscription.") == 0)
      {
        changes.push(action + " " + subscription.url);
      }
    }
    FilterNotifier.addListener(listener);
    compareSubscriptionList("Initial state", [subscription1, subscription2, subscription3]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.moveSubscription(subscription1);
    compareSubscriptionList("Move without explicit position", [subscription2, subscription3, subscription1]);
    deepEqual(changes, ["subscription.moved http://test1/"], "Received changes");
    changes = [];
    FilterStorage.moveSubscription(subscription1);
    compareSubscriptionList("Move without explicit position (subscription already last)", [subscription2, subscription3, subscription1]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.moveSubscription(subscription2, subscription1);
    compareSubscriptionList("Move with explicit position", [subscription3, subscription2, subscription1]);
    deepEqual(changes, ["subscription.moved http://test2/"], "Received changes");
    changes = [];
    FilterStorage.moveSubscription(subscription3, subscription2);
    compareSubscriptionList("Move without explicit position (subscription already at position)", [subscription3, subscription2, subscription1]);
    deepEqual(changes, [], "Received changes");
    FilterStorage.removeSubscription(subscription2);
    compareSubscriptionList("Remove", [subscription3, subscription1]);
    changes = [];
    FilterStorage.moveSubscription(subscription3, subscription2);
    compareSubscriptionList("Move before removed subscription", [subscription1, subscription3]);
    deepEqual(changes, ["subscription.moved http://test3/"], "Received changes");
    changes = [];
    FilterStorage.moveSubscription(subscription2);
    compareSubscriptionList("Move of removed subscription", [subscription1, subscription3]);
    deepEqual(changes, [], "Received changes");
  });
  test("Adding filters", function()
  {
    var subscription1 = Subscription.fromURL("~blocking");
    subscription1.defaults = ["blocking"];
    var subscription2 = Subscription.fromURL("~exceptions");
    subscription2.defaults = ["whitelist", "elemhide"];
    var subscription3 = Subscription.fromURL("~other");
    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);
    FilterStorage.addSubscription(subscription3);
    var changes = [];

    function listener(action, filter)
    {
      if (action.indexOf("filter.") == 0)
      {
        changes.push(action + " " + filter.text);
      }
    }
    FilterNotifier.addListener(listener);
    compareFiltersList("Initial state", [
      [],
      [],
      []
    ]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo"));
    compareFiltersList("Adding blocking filter", [
      ["foo"],
      [],
      []
    ]);
    deepEqual(changes, ["filter.added foo"], "Received changes");
    changes = [];
    FilterStorage.addFilter(Filter.fromText("@@bar"));
    compareFiltersList("Adding exception rule", [
      ["foo"],
      ["@@bar"],
      []
    ]);
    deepEqual(changes, ["filter.added @@bar"], "Received changes");
    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo#bar"));
    compareFiltersList("Adding hiding rule", [
      ["foo"],
      ["@@bar", "foo#bar"],
      []
    ]);
    deepEqual(changes, ["filter.added foo#bar"], "Received changes");
    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo#@#bar"));
    compareFiltersList("Adding hiding exception", [
      ["foo"],
      ["@@bar", "foo#bar", "foo#@#bar"],
      []
    ]);
    deepEqual(changes, ["filter.added foo#@#bar"], "Received changes");
    changes = [];
    FilterStorage.addFilter(Filter.fromText("!foobar"), undefined, undefined, true);
    compareFiltersList("Adding comment silent", [
      ["foo"],
      ["@@bar", "foo#bar", "foo#@#bar"],
      ["!foobar"]
    ]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo"));
    compareFiltersList("Adding already added filter", [
      ["foo"],
      ["@@bar", "foo#bar", "foo#@#bar"],
      ["!foobar"]
    ]);
    deepEqual(changes, [], "Received changes");
    subscription1.disabled = true;
    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo"));
    compareFiltersList("Adding filter already in a disabled subscription", [
      ["foo"],
      ["@@bar", "foo#bar", "foo#@#bar"],
      ["!foobar", "foo"]
    ]);
    deepEqual(changes, ["filter.added foo"], "Received changes");
    changes = [];
    FilterStorage.addFilter(Filter.fromText("foo"), subscription1);
    compareFiltersList("Adding filter to an explicit subscription", [
      ["foo", "foo"],
      ["@@bar", "foo#bar", "foo#@#bar"],
      ["!foobar", "foo"]
    ]);
    deepEqual(changes, ["filter.added foo"], "Received changes");
    changes = [];
    FilterStorage.addFilter(Filter.fromText("!foobar"), subscription2, 0);
    compareFiltersList("Adding filter to an explicit subscription with position", [
      ["foo", "foo"],
      ["!foobar", "@@bar", "foo#bar", "foo#@#bar"],
      ["!foobar", "foo"]
    ]);
    deepEqual(changes, ["filter.added !foobar"], "Received changes");
  });
  test("Removing filters", function()
  {
    var subscription1 = Subscription.fromURL("~foo");
    subscription1.filters = [Filter.fromText("foo"), Filter.fromText("foo"), Filter.fromText("bar")];
    var subscription2 = Subscription.fromURL("~bar");
    subscription2.filters = [Filter.fromText("foo"), Filter.fromText("bar"), Filter.fromText("foo")];
    var subscription3 = Subscription.fromURL("http://test/");
    subscription3.filters = [Filter.fromText("foo"), Filter.fromText("bar")];
    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);
    FilterStorage.addSubscription(subscription3);
    var changes = [];

    function listener(action, filter)
    {
      if (action.indexOf("filter.") == 0)
      {
        changes.push(action + " " + filter.text);
      }
    }
    FilterNotifier.addListener(listener);
    compareFiltersList("Initial state", [
      ["foo", "foo", "bar"],
      ["foo", "bar", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.removeFilter(Filter.fromText("foo"), subscription2, 0);
    compareFiltersList("Remove with explicit subscription and position", [
      ["foo", "foo", "bar"],
      ["bar", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, ["filter.removed foo"], "Received changes");
    changes = [];
    FilterStorage.removeFilter(Filter.fromText("foo"), subscription2, 0);
    compareFiltersList("Remove with explicit subscription and wrong position", [
      ["foo", "foo", "bar"],
      ["bar", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.removeFilter(Filter.fromText("foo"), subscription1);
    compareFiltersList("Remove with explicit subscription", [
      ["bar"],
      ["bar", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, ["filter.removed foo", "filter.removed foo"], "Received changes");
    changes = [];
    FilterStorage.removeFilter(Filter.fromText("foo"), subscription1);
    compareFiltersList("Remove from subscription not having the filter", [
      ["bar"],
      ["bar", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.removeFilter(Filter.fromText("bar"));
    compareFiltersList("Remove everywhere", [
      [],
      ["foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, ["filter.removed bar", "filter.removed bar"], "Received changes");
    changes = [];
    FilterStorage.removeFilter(Filter.fromText("bar"));
    compareFiltersList("Remove of unknown filter", [
      [],
      ["foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, [], "Received changes");
  });
  test("Moving filters", function()
  {
    var subscription1 = Subscription.fromURL("~foo");
    subscription1.filters = [Filter.fromText("foo"), Filter.fromText("bar"), Filter.fromText("bas"), Filter.fromText("foo")];
    var subscription2 = Subscription.fromURL("http://test/");
    subscription2.filters = [Filter.fromText("foo"), Filter.fromText("bar")];
    FilterStorage.addSubscription(subscription1);
    FilterStorage.addSubscription(subscription2);
    var changes = [];

    function listener(action, filter)
    {
      if (action.indexOf("filter.") == 0)
      {
        changes.push(action + " " + filter.text);
      }
    }
    FilterNotifier.addListener(listener);
    compareFiltersList("Initial state", [
      ["foo", "bar", "bas", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.moveFilter(Filter.fromText("foo"), subscription1, 0, 1);
    compareFiltersList("Regular move", [
      ["bar", "foo", "bas", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, ["filter.moved foo"], "Received changes");
    changes = [];
    FilterStorage.moveFilter(Filter.fromText("foo"), subscription1, 0, 3);
    compareFiltersList("Invalid move", [
      ["bar", "foo", "bas", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.moveFilter(Filter.fromText("foo"), subscription2, 0, 1);
    compareFiltersList("Invalid subscription", [
      ["bar", "foo", "bas", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.moveFilter(Filter.fromText("foo"), subscription1, 1, 1);
    compareFiltersList("Move to current position", [
      ["bar", "foo", "bas", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, [], "Received changes");
    changes = [];
    FilterStorage.moveFilter(Filter.fromText("bar"), subscription1, 0, 1);
    compareFiltersList("Regular move", [
      ["foo", "bar", "bas", "foo"],
      ["foo", "bar"]
    ]);
    deepEqual(changes, ["filter.moved bar"], "Received changes");
  });
  test("Hit counts", function()
  {
    var changes = [];

    function listener(action, filter)
    {
      if (action.indexOf("filter.") == 0)
      {
        changes.push(action + " " + filter.text);
      }
    }
    FilterNotifier.addListener(listener);
    var filter1 = Filter.fromText("filter1");
    var filter2 = Filter.fromText("filter2");
    FilterStorage.addFilter(filter1);
    equal(filter1.hitCount, 0, "filter1 initial hit count");
    equal(filter2.hitCount, 0, "filter2 initial hit count");
    equal(filter1.lastHit, 0, "filter1 initial last hit");
    equal(filter2.lastHit, 0, "filter2 initial last hit");
    changes = [];
    FilterStorage.increaseHitCount(filter1);
    equal(filter1.hitCount, 1, "Hit count after increase (filter in list)");
    ok(filter1.lastHit > 0, "Last hit changed after increase");
    deepEqual(changes, ["filter.hitCount filter1", "filter.lastHit filter1"], "Received changes");
    changes = [];
    FilterStorage.increaseHitCount(filter2);
    equal(filter2.hitCount, 1, "Hit count after increase (filter not in list)");
    ok(filter2.lastHit > 0, "Last hit changed after increase");
    deepEqual(changes, ["filter.hitCount filter2", "filter.lastHit filter2"], "Received changes");
    changes = [];
    FilterStorage.resetHitCounts([filter1]);
    equal(filter1.hitCount, 0, "Hit count after reset");
    equal(filter1.lastHit, 0, "Last hit after reset");
    deepEqual(changes, ["filter.hitCount filter1", "filter.lastHit filter1"], "Received changes");
    changes = [];
    FilterStorage.resetHitCounts(null);
    equal(filter2.hitCount, 0, "Hit count after complete reset");
    equal(filter2.lastHit, 0, "Last hit after complete reset");
    deepEqual(changes, ["filter.hitCount filter2", "filter.lastHit filter2"], "Received changes");
  });
  test("Filter/subscription relationship", function()
  {
    var filter1 = Filter.fromText("filter1");
    var filter2 = Filter.fromText("filter2");
    var filter3 = Filter.fromText("filter3");
    var subscription1 = Subscription.fromURL("http://test1/");
    subscription1.filters = [filter1, filter2];
    var subscription2 = Subscription.fromURL("http://test2/");
    subscription2.filters = [filter2, filter3];
    var subscription3 = Subscription.fromURL("http://test3/");
    subscription3.filters = [filter1, filter2, filter3];
    compareFilterSubscriptions("Initial filter1 subscriptions", filter1, []);
    compareFilterSubscriptions("Initial filter2 subscriptions", filter2, []);
    compareFilterSubscriptions("Initial filter3 subscriptions", filter3, []);
    FilterStorage.addSubscription(subscription1);
    compareFilterSubscriptions("filter1 subscriptions after adding http://test1/", filter1, [subscription1]);
    compareFilterSubscriptions("filter2 subscriptions after adding http://test1/", filter2, [subscription1]);
    compareFilterSubscriptions("filter3 subscriptions after adding http://test1/", filter3, []);
    FilterStorage.addSubscription(subscription2);
    compareFilterSubscriptions("filter1 subscriptions after adding http://test2/", filter1, [subscription1]);
    compareFilterSubscriptions("filter2 subscriptions after adding http://test2/", filter2, [subscription1, subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after adding http://test2/", filter3, [subscription2]);
    FilterStorage.removeSubscription(subscription1);
    compareFilterSubscriptions("filter1 subscriptions after removing http://test1/", filter1, []);
    compareFilterSubscriptions("filter2 subscriptions after removing http://test1/", filter2, [subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after removing http://test1/", filter3, [subscription2]);
    FilterStorage.updateSubscriptionFilters(subscription3, [filter3]);
    compareFilterSubscriptions("filter1 subscriptions after updating http://test3/ filters", filter1, []);
    compareFilterSubscriptions("filter2 subscriptions after updating http://test3/ filters", filter2, [subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after updating http://test3/ filters", filter3, [subscription2]);
    FilterStorage.addSubscription(subscription3);
    compareFilterSubscriptions("filter1 subscriptions after adding http://test3/", filter1, []);
    compareFilterSubscriptions("filter2 subscriptions after adding http://test3/", filter2, [subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after adding http://test3/", filter3, [subscription2, subscription3]);
    FilterStorage.updateSubscriptionFilters(subscription3, [filter1, filter2]);
    compareFilterSubscriptions("filter1 subscriptions after updating http://test3/ filters", filter1, [subscription3]);
    compareFilterSubscriptions("filter2 subscriptions after updating http://test3/ filters", filter2, [subscription2, subscription3]);
    compareFilterSubscriptions("filter3 subscriptions after updating http://test3/ filters", filter3, [subscription2]);
    FilterStorage.removeSubscription(subscription3);
    compareFilterSubscriptions("filter1 subscriptions after removing http://test3/", filter1, []);
    compareFilterSubscriptions("filter2 subscriptions after removing http://test3/", filter2, [subscription2]);
    compareFilterSubscriptions("filter3 subscriptions after removing http://test3/", filter3, [subscription2]);
  });
})();
(function()
{
  module("Filter matcher",
  {
    setup: prepareFilterComponents,
    teardown: restoreFilterComponents
  });

  function compareKeywords(text, expected)
  {
    for (var _loopIndex4 = 0; _loopIndex4 < [Filter.fromText(text), Filter.fromText("@@" + text)].length; ++_loopIndex4)
    {
      var filter = [Filter.fromText(text), Filter.fromText("@@" + text)][_loopIndex4];
      var matcher = new Matcher();
      var result = [];
      for (var _loopIndex5 = 0; _loopIndex5 < expected.length; ++_loopIndex5)
      {
        var dummy = expected[_loopIndex5];
        var keyword = matcher.findKeyword(filter);
        result.push(keyword);
        if (keyword)
        {
          var dummyFilter = Filter.fromText("^" + keyword + "^");
          dummyFilter.filterCount = Infinity;
          matcher.add(dummyFilter);
        }
      }
      equal(result.join(", "), expected.join(", "), "Keyword candidates for " + filter.text);
    }
  }

  function checkMatch(filters, location, contentType, docDomain, thirdParty, sitekey, specificOnly, expected)
  {
    var matcher = new Matcher();
    for (var _loopIndex6 = 0; _loopIndex6 < filters.length; ++_loopIndex6)
    {
      var filter = filters[_loopIndex6];
      matcher.add(Filter.fromText(filter));
    }
    var result = matcher.matchesAny(location, RegExpFilter.typeMap[contentType], docDomain, thirdParty, sitekey, specificOnly);
    if (result)
    {
      result = result.text;
    }
    equal(result, expected, "match(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ", " + (sitekey || "no-sitekey") + ", " + (specificOnly ? "specificOnly" : "not-specificOnly") + ") with:\n" + filters.join("\n"));
    var combinedMatcher = new CombinedMatcher();
    for (var i = 0; i < 2; i++)
    {
      for (var _loopIndex7 = 0; _loopIndex7 < filters.length; ++_loopIndex7)
      {
        var filter = filters[_loopIndex7];
        combinedMatcher.add(Filter.fromText(filter));
      }
      var result = combinedMatcher.matchesAny(location, RegExpFilter.typeMap[contentType], docDomain, thirdParty, sitekey, specificOnly);
      if (result)
      {
        result = result.text;
      }
      equal(result, expected, "combinedMatch(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ", " + (sitekey || "no-sitekey") + ", " + (specificOnly ? "specificOnly" : "not-specificOnly") + ") with:\n" + filters.join("\n"));
      if (specificOnly)
      {
        continue;
      }
      filters = filters.map(function(text)
      {
        return text.substr(0, 2) == "@@" ? text : "@@" + text;
      });
      if (expected && expected.substr(0, 2) != "@@")
      {
        expected = "@@" + expected;
      }
    }
  }

  function cacheCheck(matcher, location, contentType, docDomain, thirdParty, expected)
  {
    var result = matcher.matchesAny(location, RegExpFilter.typeMap[contentType], docDomain, thirdParty);
    if (result)
    {
      result = result.text;
    }
    equal(result, expected, "match(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ") with static filters");
  }
  test("Matcher class definitions", function()
  {
    equal(typeof Matcher, "function", "typeof Matcher");
    equal(typeof CombinedMatcher, "function", "typeof CombinedMatcher");
    equal(typeof defaultMatcher, "object", "typeof defaultMatcher");
    ok(defaultMatcher instanceof CombinedMatcher, "defaultMatcher is a CombinedMatcher instance");
  });
  test("Keyword extraction", function()
  {
    compareKeywords("*", []);
    compareKeywords("asdf", []);
    compareKeywords("/asdf/", []);
    compareKeywords("/asdf1234", []);
    compareKeywords("/asdf/1234", ["asdf"]);
    compareKeywords("/asdf/1234^", ["asdf", "1234"]);
    compareKeywords("/asdf/123456^", ["123456", "asdf"]);
    compareKeywords("^asdf^1234^56as^", ["asdf", "1234", "56as"]);
    compareKeywords("*asdf/1234^", ["1234"]);
    compareKeywords("|asdf,1234*", ["asdf"]);
    compareKeywords("||domain.example^", ["example", "domain"]);
    compareKeywords("&asdf=1234|", ["asdf", "1234"]);
    compareKeywords("^foo%2Ebar^", ["foo%2ebar"]);
    compareKeywords("^aSdF^1234", ["asdf"]);
    compareKeywords("_asdf_1234_", ["asdf", "1234"]);
    compareKeywords("+asdf-1234=", ["asdf", "1234"]);
    compareKeywords("/123^ad2&ad&", ["123", "ad2"]);
    compareKeywords("/123^ad2&ad$script,domain=example.com", ["123", "ad2"]);
  });
  test("Filter matching", function()
  {
    checkMatch([], "http://abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["abc"], "http://abc/def", "IMAGE", null, false, null, false, "abc");
    checkMatch(["abc", "ddd"], "http://abc/def", "IMAGE", null, false, null, false, "abc");
    checkMatch(["ddd", "abc"], "http://abc/def", "IMAGE", null, false, null, false, "abc");
    checkMatch(["ddd", "abd"], "http://abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["abc", "://abc/d"], "http://abc/def", "IMAGE", null, false, null, false, "://abc/d");
    checkMatch(["://abc/d", "abc"], "http://abc/def", "IMAGE", null, false, null, false, "://abc/d");
    checkMatch(["|http://"], "http://abc/def", "IMAGE", null, false, null, false, "|http://");
    checkMatch(["|http://abc"], "http://abc/def", "IMAGE", null, false, null, false, "|http://abc");
    checkMatch(["|abc"], "http://abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["|/abc/def"], "http://abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["/def|"], "http://abc/def", "IMAGE", null, false, null, false, "/def|");
    checkMatch(["/abc/def|"], "http://abc/def", "IMAGE", null, false, null, false, "/abc/def|");
    checkMatch(["/abc/|"], "http://abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["http://abc/|"], "http://abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["|http://abc/def|"], "http://abc/def", "IMAGE", null, false, null, false, "|http://abc/def|");
    checkMatch(["|/abc/def|"], "http://abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["|http://abc/|"], "http://abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["|/abc/|"], "http://abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["||example.com/abc"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||example.com/abc");
    checkMatch(["||com/abc/def"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||com/abc/def");
    checkMatch(["||com/abc"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||com/abc");
    checkMatch(["||mple.com/abc"], "http://example.com/abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["||.com/abc/def"], "http://example.com/abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["||http://example.com/"], "http://example.com/abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["||example.com/abc/def|"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||example.com/abc/def|");
    checkMatch(["||com/abc/def|"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||com/abc/def|");
    checkMatch(["||example.com/abc|"], "http://example.com/abc/def", "IMAGE", null, false, null, false, null);
    checkMatch(["abc", "://abc/d", "asdf1234"], "http://abc/def", "IMAGE", null, false, null, false, "://abc/d");
    checkMatch(["foo*://abc/d", "foo*//abc/de", "://abc/de", "asdf1234"], "http://abc/def", "IMAGE", null, false, null, false, "://abc/de");
    checkMatch(["abc$third-party", "abc$~third-party", "ddd"], "http://abc/def", "IMAGE", null, false, null, false, "abc$~third-party");
    checkMatch(["abc$third-party", "abc$~third-party", "ddd"], "http://abc/def", "IMAGE", null, true, null, false, "abc$third-party");
    checkMatch(["//abc/def$third-party", "//abc/def$~third-party", "//abc_def"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def$~third-party");
    checkMatch(["//abc/def$third-party", "//abc/def$~third-party", "//abc_def"], "http://abc/def", "IMAGE", null, true, null, false, "//abc/def$third-party");
    checkMatch(["abc$third-party", "abc$~third-party", "//abc/def"], "http://abc/def", "IMAGE", null, true, null, false, "//abc/def");
    checkMatch(["//abc/def", "abc$third-party", "abc$~third-party"], "http://abc/def", "IMAGE", null, true, null, false, "//abc/def");
    checkMatch(["abc$third-party", "abc$~third-party", "//abc/def$third-party"], "http://abc/def", "IMAGE", null, true, null, false, "//abc/def$third-party");
    checkMatch(["abc$third-party", "abc$~third-party", "//abc/def$third-party"], "http://abc/def", "IMAGE", null, false, null, false, "abc$~third-party");
    checkMatch(["abc$third-party", "abc$~third-party", "//abc/def$~third-party"], "http://abc/def", "IMAGE", null, true, null, false, "abc$third-party");
    checkMatch(["abc$image", "abc$script", "abc$~image"], "http://abc/def", "IMAGE", null, false, null, false, "abc$image");
    checkMatch(["abc$image", "abc$script", "abc$~script"], "http://abc/def", "SCRIPT", null, false, null, false, "abc$script");
    checkMatch(["abc$image", "abc$script", "abc$~image"], "http://abc/def", "OTHER", null, false, null, false, "abc$~image");
    checkMatch(["//abc/def$image", "//abc/def$script", "//abc/def$~image"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def$image");
    checkMatch(["//abc/def$image", "//abc/def$script", "//abc/def$~script"], "http://abc/def", "SCRIPT", null, false, null, false, "//abc/def$script");
    checkMatch(["//abc/def$image", "//abc/def$script", "//abc/def$~image"], "http://abc/def", "OTHER", null, false, null, false, "//abc/def$~image");
    checkMatch(["abc$image", "abc$~image", "//abc/def"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def");
    checkMatch(["//abc/def", "abc$image", "abc$~image"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def");
    checkMatch(["abc$image", "abc$~image", "//abc/def$image"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def$image");
    checkMatch(["abc$image", "abc$~image", "//abc/def$script"], "http://abc/def", "IMAGE", null, false, null, false, "abc$image");
    checkMatch(["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "foo.com", false, null, false, "abc$domain=foo.com");
    checkMatch(["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "bar.com", false, null, false, "abc$domain=bar.com");
    checkMatch(["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "baz.com", false, null, false, "abc$domain=~foo.com|~bar.com");
    checkMatch(["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "foo.com", false, null, false, "abc$domain=foo.com");
    checkMatch(["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "bar.com", false, null, false, null);
    checkMatch(["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "baz.com", false, null, false, null);
    checkMatch(["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://ccc/def", "IMAGE", "baz.com", false, null, false, "ccc$domain=~foo.com|~bar.com");
    checkMatch(["abc$sitekey=foo-publickey", "abc$sitekey=bar-publickey"], "http://abc/def", "IMAGE", "foo.com", false, "foo-publickey", false, "abc$sitekey=foo-publickey");
    checkMatch(["abc$sitekey=foo-publickey", "abc$sitekey=bar-publickey"], "http://abc/def", "IMAGE", "bar.com", false, "bar-publickey", false, "abc$sitekey=bar-publickey");
    checkMatch(["abc$sitekey=foo-publickey", "cba$sitekey=bar-publickey"], "http://abc/def", "IMAGE", "bar.com", false, "bar-publickey", false, null);
    checkMatch(["abc$sitekey=foo-publickey", "cba$sitekey=bar-publickey"], "http://abc/def", "IMAGE", "baz.com", false, null, false, null);
    checkMatch(["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://abc/def", "IMAGE", "foo.com", false, "foo-publickey", false, "abc$sitekey=foo-publickey,domain=foo.com");
    checkMatch(["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://abc/def", "IMAGE", "foo.com", false, "bar-publickey", false, null);
    checkMatch(["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://abc/def", "IMAGE", "bar.com", false, "foo-publickey", false, null);
    checkMatch(["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://abc/def", "IMAGE", "bar.com", false, "bar-publickey", false, "abc$sitekey=bar-publickey,domain=bar.com");
    checkMatch(["@@foo.com$generichide"], "http://foo.com/bar", "GENERICHIDE", "foo.com", false, null, false, "@@foo.com$generichide");
    checkMatch(["@@foo.com$genericblock"], "http://foo.com/bar", "GENERICBLOCK", "foo.com", false, null, false, "@@foo.com$genericblock");
    checkMatch(["@@bar.com$generichide"], "http://foo.com/bar", "GENERICHIDE", "foo.com", false, null, false, null);
    checkMatch(["@@bar.com$genericblock"], "http://foo.com/bar", "GENERICBLOCK", "foo.com", false, null, false, null);
    checkMatch(["/bar"], "http://foo.com/bar", "IMAGE", "foo.com", false, null, true, null);
    checkMatch(["/bar$domain=foo.com"], "http://foo.com/bar", "IMAGE", "foo.com", false, null, true, "/bar$domain=foo.com");
  });
  test("Result cache checks", function()
  {
    var matcher = new CombinedMatcher();
    matcher.add(Filter.fromText("abc$image"));
    matcher.add(Filter.fromText("abc$script"));
    matcher.add(Filter.fromText("abc$~image,~script,~media,~ping"));
    matcher.add(Filter.fromText("cba$third-party"));
    matcher.add(Filter.fromText("cba$~third-party,~script"));
    matcher.add(Filter.fromText("http://def$image"));
    matcher.add(Filter.fromText("http://def$script"));
    matcher.add(Filter.fromText("http://def$~image,~script,~media,~ping"));
    matcher.add(Filter.fromText("http://fed$third-party"));
    matcher.add(Filter.fromText("http://fed$~third-party,~script"));
    cacheCheck(matcher, "http://abc", "IMAGE", null, false, "abc$image");
    cacheCheck(matcher, "http://abc", "SCRIPT", null, false, "abc$script");
    cacheCheck(matcher, "http://abc", "OTHER", null, false, "abc$~image,~script,~media,~ping");
    cacheCheck(matcher, "http://cba", "IMAGE", null, false, "cba$~third-party,~script");
    cacheCheck(matcher, "http://cba", "IMAGE", null, true, "cba$third-party");
    cacheCheck(matcher, "http://def", "IMAGE", null, false, "http://def$image");
    cacheCheck(matcher, "http://def", "SCRIPT", null, false, "http://def$script");
    cacheCheck(matcher, "http://def", "OTHER", null, false, "http://def$~image,~script,~media,~ping");
    cacheCheck(matcher, "http://fed", "IMAGE", null, false, "http://fed$~third-party,~script");
    cacheCheck(matcher, "http://fed", "IMAGE", null, true, "http://fed$third-party");
    cacheCheck(matcher, "http://abc_cba", "MEDIA", null, false, "cba$~third-party,~script");
    cacheCheck(matcher, "http://abc_cba", "MEDIA", null, true, "cba$third-party");
    cacheCheck(matcher, "http://abc_cba", "SCRIPT", null, false, "abc$script");
    cacheCheck(matcher, "http://def?http://fed", "MEDIA", null, false, "http://fed$~third-party,~script");
    cacheCheck(matcher, "http://def?http://fed", "MEDIA", null, true, "http://fed$third-party");
    cacheCheck(matcher, "http://def?http://fed", "SCRIPT", null, false, "http://def$script");
  });
})();
(function()
{
  module("Preferences",
  {
    setup: function()
    {
      preparePrefs.call(this);
    },
    teardown: function()
    {
      restorePrefs.call(this);
    }
  });

  function checkPrefExists(name, expectedValue, description, assert)
  {
    if ("chrome" in window)
    {
      var done = assert.async();
      var key = "pref:" + name;
      chrome.storage.local.get(key, function(items)
      {
        equal(key in items, expectedValue, description);
        done();
      });
    }
    else
    {
      equal(Services.prefs.prefHasUserValue("extensions.adblockplus." + name), expectedValue, description);
    }
  }

  function checkPref(name, expectedValue, description, assert)
  {
    if ("chrome" in window)
    {
      var done = assert.async();
      var key = "pref:" + name;
      chrome.storage.local.get(key, function(items)
      {
        deepEqual(items[key], expectedValue, description);
        done();
      });
    }
    else
    {
      var pref = "extensions.adblockplus." + name;
      var value = null;
      switch (typeof expectedValue)
      {
      case "number":
        value = Services.prefs.getIntPref(pref);
        break;
      case "boolean":
        value = Services.prefs.getBoolPref(pref);
        break;
      case "string":
        value = Services.prefs.getComplexValue(pref, Ci.nsISupportsString).data;
        break;
      case "object":
        value = JSON.parse(Services.prefs.getComplexValue(pref, Ci.nsISupportsString).data);
        break;
      }
      deepEqual(value, expectedValue, description);
    }
  }
  test("Numerical pref", function(assert)
  {
    Prefs.patternsbackups = 5;
    equal(Prefs.patternsbackups, 5, "Prefs object returns the correct value after setting pref to default value");
    checkPrefExists("patternsbackups", false, "User-defined pref has been removed", assert);
    Prefs.patternsbackups = 12;
    equal(Prefs.patternsbackups, 12, "Prefs object returns the correct value after setting pref to non-default value");
    checkPrefExists("patternsbackups", true, "User-defined pref has been created", assert);
    checkPref("patternsbackups", 12, "Value has been written", assert);
  });
  test("Boolean pref", function(assert)
  {
    Prefs.enabled = true;
    equal(Prefs.enabled, true, "Prefs object returns the correct value after setting pref to default value");
    checkPrefExists("enabled", false, "User-defined pref has been removed", assert);
    Prefs.enabled = false;
    equal(Prefs.enabled, false, "Prefs object returns the correct value after setting pref to non-default value");
    checkPrefExists("enabled", true, "User-defined pref has been created", assert);
    checkPref("enabled", false, "Value has been written", assert);
  });
  test("String pref", function(assert)
  {
    var defaultValue = "https://notification.adblockplus.org/notification.json";
    Prefs.notificationurl = defaultValue;
    equal(Prefs.notificationurl, defaultValue, "Prefs object returns the correct value after setting pref to default value");
    checkPrefExists("notificationurl", false, "User-defined pref has been removed", assert);
    var newValue = "https://notification.adblockplus.org/fooሴbar.json";
    Prefs.notificationurl = newValue;
    equal(Prefs.notificationurl, newValue, "Prefs object returns the correct value after setting pref to non-default value");
    checkPrefExists("notificationurl", true, "User-defined pref has been created", assert);
    checkPref("notificationurl", newValue, "Value has been written", assert);
  });
  test("Object pref (complete replacement)", function(assert)
  {
    Prefs.notificationdata = {};
    deepEqual(Prefs.notificationdata,
    {}, "Prefs object returns the correct value after setting pref to default value");
    var newValue = {
      foo: 1,
      bar: "adsfሴ"
    };
    Prefs.notificationdata = newValue;
    equal(Prefs.notificationdata, newValue, "Prefs object returns the correct value after setting pref to non-default value");
    checkPrefExists("notificationdata", true, "User-defined pref has been created", assert);
    checkPref("notificationdata", newValue, "Value has been written", assert);
  });
  test("Property-wise modification", function(assert)
  {
    Prefs.notificationdata = {};
    Prefs.notificationdata.foo = 1;
    Prefs.notificationdata.bar = 2;
    Prefs.notificationdata = JSON.parse(JSON.stringify(Prefs.notificationdata));
    deepEqual(Prefs.notificationdata,
    {
      foo: 1,
      bar: 2
    }, "Prefs object returns the correct value after setting pref to non-default value");
    checkPrefExists("notificationdata", true, "User-defined pref has been created", assert);
    checkPref("notificationdata",
    {
      foo: 1,
      bar: 2
    }, "Value has been written", assert);
    delete Prefs.notificationdata.foo;
    delete Prefs.notificationdata.bar;
    Prefs.notificationdata = JSON.parse(JSON.stringify(Prefs.notificationdata));
    deepEqual(Prefs.notificationdata,
    {}, "Prefs object returns the correct value after setting pref to default value");
  });
})();
(function()
{
  module("Matching of blocking filters",
  {
    setup: prepareFilterComponents,
    teardown: restoreFilterComponents
  });

  function testMatch(text, location, contentType, docDomain, thirdParty, sitekey, expected)
  {
    function testMatch_internal(text, location, contentType, docDomain, thirdParty, sitekey, expected)
    {
      var filter = Filter.fromText(text);
      var result = filter.matches(location, RegExpFilter.typeMap[contentType], docDomain, thirdParty, sitekey);
      equal(!!result, expected, "\"" + text + "\".matches(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ", " + (sitekey || "no-sitekey") + ")");
    }
    testMatch_internal(text, location, contentType, docDomain, thirdParty, sitekey, expected);
    if (!/^@@/.test(text))
    {
      testMatch_internal("@@" + text, location, contentType, docDomain, thirdParty, sitekey, expected);
    }
  }
  test("Basic filters", function()
  {
    testMatch("abc", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc", "http://ABC/adf", "IMAGE", null, false, null, true);
    testMatch("abc", "http://abd/adf", "IMAGE", null, false, null, false);
    testMatch("|abc", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("|http://abc", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc|", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc/adf|", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("||example.com/foo", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
    testMatch("||com/foo", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
    testMatch("||mple.com/foo", "http://example.com/foo/bar", "IMAGE", null, false, null, false);
    testMatch("||/example.com/foo", "http://example.com/foo/bar", "IMAGE", null, false, null, false);
    testMatch("||example.com/foo/bar|", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
    testMatch("||example.com/foo", "http://foo.com/http://example.com/foo/bar", "IMAGE", null, false, null, false);
    testMatch("||example.com/foo|", "http://example.com/foo/bar", "IMAGE", null, false, null, false);
  });
  test("Separator placeholders", function()
  {
    testMatch("abc^d", "http://abc/def", "IMAGE", null, false, null, true);
    testMatch("abc^e", "http://abc/def", "IMAGE", null, false, null, false);
    testMatch("def^", "http://abc/def", "IMAGE", null, false, null, true);
    testMatch("http://abc/d^f", "http://abc/def", "IMAGE", null, false, null, false);
    testMatch("http://abc/def^", "http://abc/def", "IMAGE", null, false, null, true);
    testMatch("^foo=bar^", "http://abc/?foo=bar", "IMAGE", null, false, null, true);
    testMatch("^foo=bar^", "http://abc/?a=b&foo=bar", "IMAGE", null, false, null, true);
    testMatch("^foo=bar^", "http://abc/?foo=bar&a=b", "IMAGE", null, false, null, true);
    testMatch("^foo=bar^", "http://abc/?notfoo=bar", "IMAGE", null, false, null, false);
    testMatch("^foo=bar^", "http://abc/?foo=barnot", "IMAGE", null, false, null, false);
    testMatch("^foo=bar^", "http://abc/?foo=bar%2Enot", "IMAGE", null, false, null, false);
    testMatch("||example.com^", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
    testMatch("||example.com^", "http://example.company.com/foo/bar", "IMAGE", null, false, null, false);
    testMatch("||example.com^", "http://example.com:1234/foo/bar", "IMAGE", null, false, null, true);
    testMatch("||example.com^", "http://example.com.com/foo/bar", "IMAGE", null, false, null, false);
    testMatch("||example.com^", "http://example.com-company.com/foo/bar", "IMAGE", null, false, null, false);
    testMatch("||example.com^foo", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
    testMatch("||пример.ру^", "http://пример.ру/foo/bar", "IMAGE", null, false, null, true);
    testMatch("||пример.ру^", "http://пример.руководитель.ру/foo/bar", "IMAGE", null, false, null, false);
    testMatch("||пример.ру^", "http://пример.ру:1234/foo/bar", "IMAGE", null, false, null, true);
    testMatch("||пример.ру^", "http://пример.ру.ру/foo/bar", "IMAGE", null, false, null, false);
    testMatch("||пример.ру^", "http://пример.ру-ководитель.ру/foo/bar", "IMAGE", null, false, null, false);
    testMatch("||пример.ру^foo", "http://пример.ру/foo/bar", "IMAGE", null, false, null, true);
  });
  test("Wildcard matching", function()
  {
    testMatch("abc*d", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc*d", "http://abcd/af", "IMAGE", null, false, null, true);
    testMatch("abc*d", "http://abc/d/af", "IMAGE", null, false, null, true);
    testMatch("abc*d", "http://dabc/af", "IMAGE", null, false, null, false);
    testMatch("*abc", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc*", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("|*abc", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc*|", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc***d", "http://abc/adf", "IMAGE", null, false, null, true);
  });
  test("Type options", function()
  {
    testMatch("abc$image", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$other", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$other", "http://abc/adf", "OTHER", null, false, null, true);
    testMatch("abc$~other", "http://abc/adf", "OTHER", null, false, null, false);
    testMatch("abc$script", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$script", "http://abc/adf", "SCRIPT", null, false, null, true);
    testMatch("abc$~script", "http://abc/adf", "SCRIPT", null, false, null, false);
    testMatch("abc$stylesheet", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$stylesheet", "http://abc/adf", "STYLESHEET", null, false, null, true);
    testMatch("abc$~stylesheet", "http://abc/adf", "STYLESHEET", null, false, null, false);
    testMatch("abc$object", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$object", "http://abc/adf", "OBJECT", null, false, null, true);
    testMatch("abc$~object", "http://abc/adf", "OBJECT", null, false, null, false);
    testMatch("abc$document", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$document", "http://abc/adf", "DOCUMENT", null, false, null, true);
    testMatch("abc$~document", "http://abc/adf", "DOCUMENT", null, false, null, false);
    testMatch("abc$subdocument", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$subdocument", "http://abc/adf", "SUBDOCUMENT", null, false, null, true);
    testMatch("abc$~subdocument", "http://abc/adf", "SUBDOCUMENT", null, false, null, false);
    testMatch("abc$background", "http://abc/adf", "OBJECT", null, false, null, false);
    testMatch("abc$background", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$~background", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$xbl", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$xbl", "http://abc/adf", "XBL", null, false, null, true);
    testMatch("abc$~xbl", "http://abc/adf", "XBL", null, false, null, false);
    testMatch("abc$ping", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$ping", "http://abc/adf", "PING", null, false, null, true);
    testMatch("abc$~ping", "http://abc/adf", "PING", null, false, null, false);
    testMatch("abc$xmlhttprequest", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$xmlhttprequest", "http://abc/adf", "XMLHTTPREQUEST", null, false, null, true);
    testMatch("abc$~xmlhttprequest", "http://abc/adf", "XMLHTTPREQUEST", null, false, null, false);
    testMatch("abc$object-subrequest", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$object-subrequest", "http://abc/adf", "OBJECT_SUBREQUEST", null, false, null, true);
    testMatch("abc$~object-subrequest", "http://abc/adf", "OBJECT_SUBREQUEST", null, false, null, false);
    testMatch("abc$dtd", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$dtd", "http://abc/adf", "DTD", null, false, null, true);
    testMatch("abc$~dtd", "http://abc/adf", "DTD", null, false, null, false);
    testMatch("abc$media", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$media", "http://abc/adf", "MEDIA", null, false, null, true);
    testMatch("abc$~media", "http://abc/adf", "MEDIA", null, false, null, false);
    testMatch("abc$font", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$font", "http://abc/adf", "FONT", null, false, null, true);
    testMatch("abc$~font", "http://abc/adf", "FONT", null, false, null, false);
    testMatch("abc$ping", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$ping", "http://abc/adf", "PING", null, false, null, true);
    testMatch("abc$~ping", "http://abc/adf", "PING", null, false, null, false);
    testMatch("abc$image,script", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$~image", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$~script", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$~image,~script", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$~script,~image", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$~document,~script,~other", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$~image,image", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$image,~image", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$~image,image", "http://abc/adf", "SCRIPT", null, false, null, true);
    testMatch("abc$image,~image", "http://abc/adf", "SCRIPT", null, false, null, false);
    testMatch("abc$match-case", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$match-case", "http://ABC/adf", "IMAGE", null, false, null, false);
    testMatch("abc$~match-case", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$~match-case", "http://ABC/adf", "IMAGE", null, false, null, true);
    testMatch("abc$match-case,image", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$match-case,script", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$match-case,image", "http://ABC/adf", "IMAGE", null, false, null, false);
    testMatch("abc$match-case,script", "http://ABC/adf", "IMAGE", null, false, null, false);
    testMatch("abc$third-party", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$third-party", "http://abc/adf", "IMAGE", null, true, null, true);
    testMatch("abd$third-party", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abd$third-party", "http://abc/adf", "IMAGE", null, true, null, false);
    testMatch("abc$image,third-party", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$image,third-party", "http://abc/adf", "IMAGE", null, true, null, true);
    testMatch("abc$~image,third-party", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abc$~image,third-party", "http://abc/adf", "IMAGE", null, true, null, false);
    testMatch("abc$~third-party", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$~third-party", "http://abc/adf", "IMAGE", null, true, null, false);
    testMatch("abd$~third-party", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("abd$~third-party", "http://abc/adf", "IMAGE", null, true, null, false);
    testMatch("abc$image,~third-party", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("abc$image,~third-party", "http://abc/adf", "IMAGE", null, true, null, false);
    testMatch("abc$~image,~third-party", "http://abc/adf", "IMAGE", null, false, null, false);
  });
  test("Regular expressions", function()
  {
    testMatch("/abc/", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("/abc/", "http://abcd/adf", "IMAGE", null, false, null, true);
    testMatch("*/abc/", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("*/abc/", "http://abcd/adf", "IMAGE", null, false, null, false);
    testMatch("/a\\wc/", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("/a\\wc/", "http://a1c/adf", "IMAGE", null, false, null, true);
    testMatch("/a\\wc/", "http://a_c/adf", "IMAGE", null, false, null, true);
    testMatch("/a\\wc/", "http://a%c/adf", "IMAGE", null, false, null, false);
  });
  test("Regular expressions with type options", function()
  {
    testMatch("/abc/$image", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("/abc/$image", "http://aBc/adf", "IMAGE", null, false, null, true);
    testMatch("/abc/$script", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("/abc/$~image", "http://abcd/adf", "IMAGE", null, false, null, false);
    testMatch("/ab{2}c/$image", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("/ab{2}c/$script", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("/ab{2}c/$~image", "http://abcd/adf", "IMAGE", null, false, null, false);
    testMatch("/abc/$third-party", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("/abc/$third-party", "http://abc/adf", "IMAGE", null, true, null, true);
    testMatch("/abc/$~third-party", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("/abc/$~third-party", "http://abc/adf", "IMAGE", null, true, null, false);
    testMatch("/abc/$match-case", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("/abc/$match-case", "http://aBc/adf", "IMAGE", null, true, null, false);
    testMatch("/ab{2}c/$match-case", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("/ab{2}c/$match-case", "http://aBc/adf", "IMAGE", null, true, null, false);
    testMatch("/abc/$~match-case", "http://abc/adf", "IMAGE", null, false, null, true);
    testMatch("/abc/$~match-case", "http://aBc/adf", "IMAGE", null, true, null, true);
    testMatch("/ab{2}c/$~match-case", "http://abc/adf", "IMAGE", null, false, null, false);
    testMatch("/ab{2}c/$~match-case", "http://aBc/adf", "IMAGE", null, true, null, false);
  });
  test("Domain restrictions", function()
  {
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "foo.com.", true, null, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "Foo.com", true, null, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, true);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, false);
    testMatch("abc$domain=foo.com", "http://abc/def", "IMAGE", null, true, null, false);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "foo.com.", true, null, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "Foo.com", true, null, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, true);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, false);
    testMatch("abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", null, true, null, false);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "foo.com.", true, null, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "Foo.com", true, null, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, true);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, false);
    testMatch("abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", null, true, null, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "foo.com.", true, null, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "Foo.com", true, null, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, false);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, true);
    testMatch("abc$domain=~foo.com", "http://abc/def", "IMAGE", null, true, null, true);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "foo.com.", true, null, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "Foo.com", true, null, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, false);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, true);
    testMatch("abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", null, true, null, true);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "foo.com.", true, null, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "Foo.com", true, null, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, false);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, true);
    testMatch("abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", null, true, null, true);
    testMatch("abc$domain=foo.com|~bar.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
    testMatch("abc$domain=foo.com|~bar.com", "http://abc/def", "IMAGE", "bar.com", true, null, false);
    testMatch("abc$domain=foo.com|~bar.com", "http://abc/def", "IMAGE", "baz.com", true, null, false);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, true);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "bar.foo.com", true, null, false);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "www.bar.foo.com", true, null, false);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "baz.com", true, null, false);
    testMatch("abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, false);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "bar.com", true, null, true);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "bar.net", true, null, false);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "foo.net", true, null, false);
    testMatch("abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "com", true, null, true);
    testMatch("abc$domain=foo.com", "http://ccc/def", "IMAGE", "foo.com", true, null, false);
    testMatch("abc$domain=foo.com", "http://ccc/def", "IMAGE", "bar.com", true, null, false);
    testMatch("abc$image,domain=foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
    testMatch("abc$image,domain=foo.com", "http://abc/def", "IMAGE", "bar.com", true, null, false);
    testMatch("abc$image,domain=foo.com", "http://abc/def", "OBJECT", "foo.com", true, null, false);
    testMatch("abc$image,domain=foo.com", "http://abc/def", "OBJECT", "bar.com", true, null, false);
    testMatch("abc$~image,domain=foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
    testMatch("abc$~image,domain=foo.com", "http://abc/def", "IMAGE", "bar.com", true, null, false);
    testMatch("abc$~image,domain=foo.com", "http://abc/def", "OBJECT", "foo.com", true, null, true);
    testMatch("abc$~image,domain=foo.com", "http://abc/def", "OBJECT", "bar.com", true, null, false);
    testMatch("abc$domain=foo.com,image", "http://abc/def", "IMAGE", "foo.com", true, null, true);
    testMatch("abc$domain=foo.com,image", "http://abc/def", "IMAGE", "bar.com", true, null, false);
    testMatch("abc$domain=foo.com,image", "http://abc/def", "OBJECT", "foo.com", true, null, false);
    testMatch("abc$domain=foo.com,image", "http://abc/def", "OBJECT", "bar.com", true, null, false);
    testMatch("abc$domain=foo.com,~image", "http://abc/def", "IMAGE", "foo.com", true, null, false);
    testMatch("abc$domain=foo.com,~image", "http://abc/def", "IMAGE", "bar.com", true, null, false);
    testMatch("abc$domain=foo.com,~image", "http://abc/def", "OBJECT", "foo.com", true, null, true);
    testMatch("abc$domain=foo.com,~image", "http://abc/def", "OBJECT", "bar.com", true, null, false);
  });
  test("Sitekey restrictions", function()
  {
    testMatch("abc$sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", true);
    testMatch("abc$sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, null, false);
    testMatch("abc$sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "bar-publickey", false);
    testMatch("abc$sitekey=foo-publickey|bar-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", true);
    testMatch("abc$sitekey=foo-publickey|bar-publickey", "http://abc/def", "IMAGE", "foo.com", true, null, false);
    testMatch("abc$sitekey=bar-publickey|foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", true);
    testMatch("abc$sitekey=foo-publickey", "http://ccc/def", "IMAGE", "foo.com", true, "foo-publickey", false);
    testMatch("abc$domain=foo.com,sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", true);
    testMatch("abc$domain=foo.com,sitekey=foo-publickey", "http://abc/def", "IMAGE", "bar.com", true, "foo-publickey", false);
    testMatch("abc$domain=~foo.com,sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", false);
    testMatch("abc$domain=~foo.com,sitekey=foo-publickey", "http://abc/def", "IMAGE", "bar.com", true, "foo-publickey", true);
  });
  test("Exception rules", function()
  {
    testMatch("@@test", "http://test/", "DOCUMENT", null, false, null, false);
    testMatch("@@http://test*", "http://test/", "DOCUMENT", null, false, null, false);
    testMatch("@@ftp://test*", "ftp://test/", "DOCUMENT", null, false, null, false);
    testMatch("@@test$document", "http://test/", "DOCUMENT", null, false, null, true);
    testMatch("@@test$document,image", "http://test/", "DOCUMENT", null, false, null, true);
    testMatch("@@test$~image", "http://test/", "DOCUMENT", null, false, null, false);
    testMatch("@@test$~image,document", "http://test/", "DOCUMENT", null, false, null, true);
    testMatch("@@test$document,~image", "http://test/", "DOCUMENT", null, false, null, true);
    testMatch("@@test$document,domain=foo.com", "http://test/", "DOCUMENT", "foo.com", false, null, true);
    testMatch("@@test$document,domain=foo.com", "http://test/", "DOCUMENT", "bar.com", false, null, false);
    testMatch("@@test$document,domain=~foo.com", "http://test/", "DOCUMENT", "foo.com", false, null, false);
    testMatch("@@test$document,domain=~foo.com", "http://test/", "DOCUMENT", "bar.com", false, null, true);
    testMatch("@@test$document,sitekey=foo-publickey", "http://test/", "DOCUMENT", "foo.com", false, "foo-publickey", true);
    testMatch("@@test$document,sitekey=foo-publickey", "http://test/", "DOCUMENT", "foo.com", false, null, false);
  });
})();
(function()
{
  module("Subscription classes",
  {
    setup: prepareFilterComponents,
    teardown: restoreFilterComponents
  });

  function compareSubscription(url, expected, postInit)
  {
    expected.push("[Subscription]");
    var subscription = Subscription.fromURL(url);
    if (postInit)
    {
      postInit(subscription);
    }
    var result = [];
    subscription.serialize(result);
    equal(result.sort().join("\n"), expected.sort().join("\n"), url);
    var map = {
      __proto__: null
    };
    for (var _loopIndex8 = 0; _loopIndex8 < result.slice(1).length; ++_loopIndex8)
    {
      var line = result.slice(1)[_loopIndex8];
      if (/(.*?)=(.*)/.test(line))
      {
        map[RegExp.$1] = RegExp.$2;
      }
    }
    var subscription2 = Subscription.fromObject(map);
    equal(subscription.toString(), subscription2.toString(), url + " deserialization");
  }
  test("Subscription class definitions", function()
  {
    equal(typeof Subscription, "function", "typeof Subscription");
    equal(typeof SpecialSubscription, "function", "typeof SpecialSubscription");
    equal(typeof RegularSubscription, "function", "typeof RegularSubscription");
    equal(typeof ExternalSubscription, "function", "typeof ExternalSubscription");
    equal(typeof DownloadableSubscription, "function", "typeof DownloadableSubscription");
  });
  test("Subscriptions with state", function()
  {
    compareSubscription("~fl~", ["url=~fl~", "title=" + Utils.getString("newGroup_title")]);
    compareSubscription("http://test/default", ["url=http://test/default", "title=http://test/default"]);
    compareSubscription("http://test/default_titled", ["url=http://test/default_titled", "title=test"], function(subscription)
    {
      subscription.title = "test";
    });
    compareSubscription("http://test/non_default", ["url=http://test/non_default", "title=test", "disabled=true", "lastSuccess=8", "lastDownload=12", "lastCheck=16", "softExpiration=18", "expires=20", "downloadStatus=foo", "errors=3", "version=24", "requiredVersion=0.6"], function(subscription)
    {
      subscription.title = "test";
      subscription.disabled = true;
      subscription.lastSuccess = 8;
      subscription.lastDownload = 12;
      subscription.lastCheck = 16;
      subscription.softExpiration = 18;
      subscription.expires = 20;
      subscription.downloadStatus = "foo";
      subscription.errors = 3;
      subscription.version = 24;
      subscription.requiredVersion = "0.6";
    });
    compareSubscription("~wl~", ["url=~wl~", "disabled=true", "title=Test group"], function(subscription)
    {
      subscription.title = "Test group";
      subscription.disabled = true;
    });
  });
})();
