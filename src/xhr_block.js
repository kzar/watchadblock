var block_xhr_requests = function(debug_logging) {
  function insert_blocking_code(filters) {
    var d = document.documentElement;
    var log = (debug_logging ? "console.log('ADBLOCK: blocking XHR request ' + url);" : "");
    var xhr_chunk = document.createElement("script");
    xhr_chunk.innerText = "XMLHttpRequest.prototype.realOpen = XMLHttpRequest.prototype.open;" +
                          "var myOpen = function(method, url, async, user, password) {" +
                          "if (" + filters + ".test(url)) {" + log + "return;}" +
                          "this.realOpen(method, url, async, user, password);" +
                          "};" +
                          "XMLHttpRequest.prototype.open = myOpen;";
    d.insertBefore(xhr_chunk, null);
  }

  // Test to determine whether a particular bandaid should be applied
  if (/mail\.google\.com/.test(document.location.host))
    insert_blocking_code("/\&view\=ad\&/");
}