$(document).ready(function(){
  localizePage();
  $("#disableacceptableads, #disableacceptableads2").click(function(event){
    event.preventDefault();
    BGcall("unsubscribe", {id:"acceptable_ads", del:false}, function() {
      BGcall("openTab",  "options/index.html?tab=0&aadisabled=true");
    });
  });
  $("#moredetails").click(function(event){
    event.preventDefault();
    $("#details_section").slideToggle();
  });
  $("#moreinformation").
    attr("href", "https://adblockplus.org/acceptable-ads").
    attr("target", "_blank");
});
