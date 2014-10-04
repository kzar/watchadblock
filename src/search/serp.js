function modify_serp() {
  var forms = window.document.getElementsByTagName('form');
  forms = [].slice.call(forms, 0);

  forms.forEach(function(f) {
    if (f.action) {
      var element = document.createElement('input');
      element.setAttribute('type', 'hidden');
      element.setAttribute('name', 'search_plus_one');
      element.setAttribute('value', 'form');
      f.appendChild(element);
      //alert('JavaScript injected in Search FORM!');
    }
  });
};

modify_serp();