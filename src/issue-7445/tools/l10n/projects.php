<?PHP
  // Localization Helper: help translators to localize Chrome extensions.
  // Part of the AdBlock project (getadblock.com/project)
  // License: GPLv3 as part of getadblock.com/project
  //          or MIT if GPLv3 conflicts with your code's license.

  // *********************************************************************
  // Add an entry to this array to let translators use this tool with your
  // project.
  $projects = array(

    // The value to pass to the ?project= parameter
    "adblock" => array(
      // Your project's title to display to translators
      "title" => "AdBlock",
      // Your project's logo.  Will be crunched to 64 pixels tall.
      "logo_url" => "http://adblockforchrome.googlecode.com/svn/trunk/img/icon128.png",
      // The URL where the latest version of your translations can be found.
      // It must have a '%s' which will be replaced with the desired locale.
      "messages_url" => "http://adblockforchrome.googlecode.com/svn/trunk/_locales/%s/messages.json",
      // String shown to the user once they have exported their completed work,
      // so they know how to get the file to you.  HTML is OK.
      "done_instructions" => "Save this file to your local computer and then attach it to the <a href='http://code.google.com/p/adblockforchrome/issues/list?can=1&q=type%3Dl10n+-status:duplicate+-status:invalid&sort=summary&colspec=ID+Status+Summary&x=area&y=priority&cells=tiles' target='_blank'>issue for your language</a> in the issue tracker. After that, we'll take care of it."
    )

  );

  $project = $_GET["project"];
  if (!isset($project))
    $project = "adblock";

  $projectdata = $projects[$project];

  if (!$projectdata) {
    header("Status: 404");
    echo "Unknown project.";
    exit(1);
  }
?>
