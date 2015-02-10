function getHostname(href) {
  var l = window.document.createElement("a");
  l.href = href;
  return l.hostname;
};

function modifyForm() {
  var domain = getHostname(window.document.URL);

  var isGoogle = (domain.indexOf(".google.")>=0) && true;
  var isBing = (domain.indexOf("bing.com")>=0) && false;
  var isYahoo = (domain.indexOf("yahoo.com")>=0) && false;
  var isBlekko = (domain.indexOf("blekko.com")>=0) && false;
  var isDDG = (domain.indexOf("duckduckgo.com")>=0) && false;

  if (isGoogle || isBing || isYahoo || isBlekko || isDDG) {
    var forms = window.document.getElementsByTagName('form');
    forms = [].slice.call(forms, 0);

    forms.forEach(function(f) {
      if (f.action) {
        var element = document.createElement('input');
        element.setAttribute('type', 'hidden');
        element.setAttribute('name', 'search_plus_one');
        element.setAttribute('value', 'form');
        f.appendChild(element);
      }
    });
  }
};

modifyForm();