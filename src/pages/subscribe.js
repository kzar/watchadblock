$(function() {
  // Translation
  localizePage();

  // When the subscription is finished or aborted
  function finished(success) {
    $('#result').text(success ?
      translate("subscribingfinished") :
      translate("subscribingfailed"));
    window.setTimeout(function() {
      window.close();
    }, success ? 2000 : 3500);
  }

  //Get the URL
  var listUrl = document.location.search.substring(1);

  if (!/^https?\:\/\//i.test(listUrl)) {
    finished(false);
    return; // only should run on http/s pages
  }

  //Show the URL being subscribed.  If it's really long, make it wrap nicely.
  $('#listUrl').text(listUrl.replace(/(.{48,64}\W)/g, '$1 '));

  //After the subscribing is finished...
  function finished(success) {
    $('span#result').text(success ?
      translate("subscribingfinished") :
      translate("subscribingfailed"));
    window.setTimeout(function() {
      window.close();
    }, success ? 2000 : 3500);
  }

  chrome.extension.onRequest.addListener(function(request) {
    if (request.command != "filters_updated")
      return;
    if ($('span#result').text())
      return;

    BGcall('get_subscriptions_minus_text', function(subs) {
      var sub = subs['url:' + listUrl];
      if (!sub || sub.last_update) {
        // It was a well known id, so assume it succeeded, or the
        // last_update property exists, so it succeeded
        finished(true);
      } else if (sub.last_update_failed)
        finished(false);
    });
  });

});
