// TODO: To block Safari background images in <body>,
// do BGcall("shouldBlock") and if true then call 
// $(el).css("background-image", "none !important");

// until crbug.com/63397 is fixed, ignore SVG images
if (window.location != 'about:blank' && !/\.svg$/.test(document.location.href)) {

  //subscribe to the list when you click an abp: link
  $('[href^="abp:"], [href^="ABP:"]').click(function(event) {
    event.preventDefault();
    var searchquery = $(this).attr("href").replace(/^.+?\?/, '');
    if (searchquery)
      BGcall('subscribe_popup', searchquery);
  });
}
