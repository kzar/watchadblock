<?PHP
  // Localization Helper: help translators to localize Chrome extensions.
  // Part of the AdBlock project (getadblock.com/project)
  // License: GPLv3 as part of getadblock.com/project
  //          or MIT if GPLv3 conflicts with your code's license.

  require_once("projects.php");

  header("Content-Type: application/javascript");

  $locale = $_GET["locale"];

  if (!preg_match('/^[a-zA-Z_-]+$/', $locale)) {
    go("");
    exit(1);
  }

  go(file_get_contents(str_replace("%s", $locale, $projectdata["messages_url"])));

  function go($data) {
    echo "JSONLocaleCallback($data);";
  }
?>

