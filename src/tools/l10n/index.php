<? 
  // Localization Helper: help translators to localize Chrome extensions.
  // Part of the AdBlock project (getadblock.com/project)
  // License: GPLv3 as part of getadblock.com/project
  //          or MIT if GPLv3 conflicts with your code's license.

  require_once("projects.php"); 
?>

<!DOCTYPE HTML>
<html>
  <head>
    <title>Localization Helper</title>
    <meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
    <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.7/jquery.min.js"></script>
    <style>
      html {
      	background-color: #EAEAEA;
      	font-family: 'Arial', sans-serif;
      	color: #414141;
      }
      .translation_box {
        border: 2px solid grey;
        border-radius: 5px;
        padding-top: 15px;
        padding-left: 10px;
        padding-bottom: 15px;
        margin-top: 20px;
        margin-bottom: 20px;
        background-color: #D0D0D0;
      }
      #translateArea textarea {
        margin-left: 12px;
        border: 1px solid grey;
        width: 80%;
      }
      :not(a), a[download] {
        vertical-align: middle;
      }
      #translateArea i {
        margin-left: 12px;
      }
      [indent] {
        display: inline-block;
      }
      [indent='1'] {
        text-indent: 18px;
      }
      [indent='2'] {
        text-indent: 36px;
      }
      [indent='3'] {
        text-indent: 54px;
      }
      #exportArea {
        display: none;
      }
      #exportArea a {
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <img height=64 src="<?= $projectdata["logo_url"] ?>" alt="<?= $projectdata["title"] ?> Localization Helper"/>
    <span style="font-family: Arial; font-size: 48px"><?= $projectdata["title"] ?> Localization Helper</span>
    <br/><br/>
    <p id="languageselector">
      <b>Enter the language code or JSON file for the language you want to translate:</b>
      <input type="text" id="languagecode" />
      <input type="button" id="languagecodesubmit" value="Load" disabled="disabled" />
      <br/>
      <i>Example: 'nl' for Dutch, 'pt-pt' for portuguese, etcetera. If you leave it empty, an empty translation file will be created<br/>
      If you paste the content of the file you already have translated, it'll load that file instead</i><br/>
      <br/>
      <!-- TODO point to project-specific URL -->
      <u>Please make sure that you already created an issue in the issue tracker and have read <a href="http://code.google.com/p/adblockforchrome/wiki/HowToTranslate">HowToTranslate</a> before you start translating!</u><br/>
    </p>
    <div id="translateArea"></div>
    <div id="exportArea">
      <input type="button" id="exportButton" value="Export"/>
    </div>
    <script>
      var English = {}, i;
      //Load the English file
      var JSONLocaleCallback  = function(json) {
        if (json && !Object.keys(English).length) {
          English = json;
          $("#languagecodesubmit").removeAttr('disabled');
        } else if (!Object.keys(English).length) {
          alert('The English translation file could not be loaded, but is required to be loaded. Please reload this page to try again');
        } else if (json) {
          continueBelow(json);
        } else {
          alert("The language file for the language you were looking for can't be found. An empty file will be loaded instead");
          continueBelow();
        }
      };
      $.ajax({
        url: "http://chromeadblock.com/l10n/messages.php",
        data: { locale: "en", project: "<?= $project ?>" },
        dataType: "jsonp"
      });
      window.setTimeout(function() {
        if (!Object.keys(English).length && $("#languagecodesubmit").prop('disabled')) {
          // TODO allow other default locales
          alert("The English translation file could not be loaded, but is required to be loaded. Please reload this page to try again");
        }
      }, 15000);

      // Enter in language code field -> submit
      $('#languagecode').keypress(function(event) {
        if (event.keyCode === 13) {
          event.preventDefault();
          $('#languagecodesubmit').click();
        }
      });

      $("#languagecodesubmit").click(function() {
        if (this.disabled) {return;}
        var language = $("#languagecode").val().trim();
        language = language.match(/^(\w\w)([_\-]\w\w)?$/);
        if (language) {
          language = language[1].toLowerCase() + (language[2]||"").toUpperCase().replace('-', '_');
          $.ajax({
            url: "http://chromeadblock.com/l10n/messages.php",
            data: { locale: language, project: "<?= $project ?>" },
            dataType: "jsonp"
          });
          // Try to figure out if something went wrong
          window.setTimeout(function() {
            if ($("textarea").length === 0) {
              alert("The language file for the language you were looking for can't be found. An empty file will be loaded instead");
              continueBelow();
            }
          }, 15000);
          $("#languageselector input").prop("disabled", true);
        } else {
          var JSONtext;
          try {
            JSONtext = JSON.parse($("#languagecode").val() || "{}");
          } catch(ex) {
            alert('Invalid input');
          }
          if (JSONtext) {
            continueBelow(JSONtext);
          }
        }
      });

      var continueBelow = function(current) {
        current = current || {};
        if (!English || !Object.keys(English).length) {
          alert('The English translation file could not be loaded, but is required to be loaded. Please reload this page to try again');
          return;
        }
        $("#exportArea").css("display", "block");
        $("#languageselector").css("display", "none");

        var target = $("#translateArea");
        target.append(
          $('<input type="checkbox" id="hideTranslated" />').change(function() {
            if ($(this).is(":checked")) {
              $("#translateArea div").css("display", "none");
              $("#translateArea textarea").each(function() {
                if (!$(this).val()) {
                  $(this).parent("div").css("display", "block");
                }
              });
              $("#translateArea textarea ~ textarea[data-messageforid]").each(function() {
                if (/\s/.test($(this).val().replace(/(?:\$\w+\$|\$[1-9]|\<\w+.*?\>)/g, '').trim()) &&
                    $(this).val() === $(this).prevAll('textarea')[0].value) { // Smart guess
                  $(this).parent("div").css("display", "block");
                }
              });
            } else {
              $("#translateArea div").css("display", "block");
            }
          })
        ).append(
          $('<label for="hideTranslated">').text("Hide translated messages")
        );

        var IDs = Object.keys(English).sort();
        for (i=0; i<IDs.length; i++) {
          var id = IDs[i];
          var div = $("<div class='translation_box'>");
          div.append(
            $('<b>').text(id).attr('id', '__' + id)
          );
          div.append($("<br>"));
          div.append('<span indent="1">English message:</span>');
          div.append(
            $("<textarea disabled='disabled'>").val(English[id].message)
          );
          div.append($("<br>"));
          div.append('<span indent="1">Translation:</span>');
          div.append(
            $("<textarea placeholder='Enter translation here'>").
                  val(current[id]?current[id].message:'').
                  attr('data-messageForId', id)
          );
          div.append($("<br>"));
          div.append('<span indent="1">Information:</span>');
          div.append(
            $("<i>").text(English[id].description)
          );
          if (English[id].placeholders) {
            div.append($("<br>"));
            div.append('<span indent="1">Placeholder' + (Object.keys(English[id].placeholders).length !== 1 ? 's' : '') + ':</span>');
            var ph;
            for (ph in English[id].placeholders) {
              div.append($("<br>"));
              div.append(
                $('<u indent="2">').text('$' + ph + '$')
              );
              div.append($("<br>"));
              div.append('<span indent="3">English message:</span>');
              div.append(
                $("<textarea disabled='disabled'>").val(English[id].placeholders[ph].content)
              );
              div.append($("<br>"));
              div.append('<span indent="3">Translation:</span>');
              var phval = (current[id] && current[id].placeholders && current[id].placeholders[ph] ? current[id].placeholders[ph].content : '');
              var phEnglishIsNonTranslatable = /^\$[1-9]$/.test(English[id].placeholders[ph].content) || /^\<\w+[^\>\<]*\>$/.test(English[id].placeholders[ph].content);
              div.append(
                $("<textarea cols='100' rows='2' placeholder='Enter translation here'>").
                      val(phval || (phEnglishIsNonTranslatable ? English[id].placeholders[ph].content : '')).
                      attr('data-placeholderForID', id).
                      attr('data-placeholder', ph).
                      prop('disabled', phEnglishIsNonTranslatable && (English[id].placeholders[ph].content === phval || !phval))
              );
              div.append($("<br>"));
              div.append('<span indent="3">Example:</span>');
              div.append(
                $("<i>").text(English[id].placeholders[ph].example)
              );
            }
          }
          target.append(div);
        }
        
        $("textarea").bind("input", function() {
          $("#exportArea :not(input)").remove();
        });
      };

      $("#exportButton").click(function() {
        var translation = {}, x = {};
        var IDs = Object.keys(English).sort();
        $.extend(true, x, English); // We don't want object references to English...
        for (i=0; i<IDs.length; i++) {
          translation[IDs[i]] = x[IDs[i]];
        }
        for (id in translation) {
          var somethingIsEmpty = false;
          translation[id].message = $("textarea[data-messageForId='" + id + "']").val().trim();
          if (translation[id].message === "") {
            somethingIsEmpty = true;
          }
          $("textarea[data-placeholderForID='" + id + "']").each(function() {
            translation[id].placeholders[$(this).attr("data-placeholder")].content = $(this).val().trim();
            if ($(this).val().trim() === "") {
              somethingIsEmpty = true;
            }
          });
          $("#exportArea :not(input)").remove();
          if (somethingIsEmpty) {
            delete translation[id];
          } else if (!doILikeThisMessage(translation[id], id)) {
            $("#hideTranslated:checked").click().change();
            location.hash = "";
            location.hash = '__' + id;
            return;
          }
        }

        $("#exportArea").append(
          $("<a download='messages.json' title='download'>").text("Download").attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(translation, undefined, 2)))
        ).append(
          $("<br/>")
        ).append(
          $("<span>").html("<?= $projectdata["done_instructions"] ?>")
        );
        if (!/Chrome/.test(navigator.userAgent)) {
          $("#exportArea").append(
            $("<br/>")
          ).append(
            $("<span>").text("Do not paste the contents of the page directly into the issue tracker! Attach it as an attachment.")
          );
        }
        if (/Chrome\/19/.test(navigator.userAgent)) {
          $("#exportArea").append(
            $("<br/>")
          ).append(
            $("<span>").text("In Chrome 19, you have to right mouse click on the link and choose 'open in new tab'. Then paste it in a text file. When Chrome 20 is released, it'll work better.")
          );
        }
      });

      var doILikeThisMessage = function(entry, id) {
        /* THIS DOES NOT MAKE THE EXECUTABLE REDUNDANT, THESE ARE JUST VERY BASIC CHECKS! */
        var match = entry.message.replace(/\$\$/g, '===').match(/\$[\w]+\$/g),
         tmp = entry.message.replace(/\$\$/g, '==='), i;
        if (match) {
          if (!entry.placeholders) {
            alert('Placeholder ' + match[0] + ' does not exist');
            return false;
          }
          for (i=0; i<match.length; i++) {
            if (!entry.placeholders[match[i].substr(1, match[i].length-2)]) {
              alert('Placeholder ' + match[i] + ' does not exist');
              return false;
            }
          }
          tmp = tmp.replace(match, '');
        } else if (entry.placeholders) {
          alert('Placeholders were not used in the message');
          return false;
        }

        if (entry.placeholders) {
          for (i in entry.placeholders) {
            tmp += '===' + entry.placeholders[i].content;
          }
        }
        match = tmp.match(/\$[1-9]/g);
        var lastfound = 0;
        if (match) {
          var found = [];
          for (i=0; i<match.length; i++) {
            found.push(match[i].substr(1));
          }
          found.sort();
          for (i=0; i<found.length; i++) {
            if (Number(found[i]) !== lastfound && Number(found[i]) !== lastfound +1) {
              alert("Numerical placeholder $" + (lastfound+1) + " not found");
              return false;
            }
            lastfound = Number(found[i]);
          }
        }
        
        tmp = English[id].message.replace(/\$\$/g, '===');
        if (English[id].placeholders) {
          for (i in English[id].placeholders) {
            tmp = tmp.replace(new RegExp("\\$" + i + "\\$", "g"), '');
          }
          for (i in English[id].placeholders) {
            tmp += English[id].placeholders[i].content;
          }
        }
        if (new RegExp("\\$" + (lastfound+1)).test(tmp)) {
          alert("Numerical placeholder $" + (lastfound+1) + " not found");
          return false;
        }

        if ((/\&gt\;/.test(tmp) || /\&\#0*60\;/.test(tmp)) && ((/\&lt\;/.test(tmp) || /\&\#0*62\;/.test(tmp)))) {
          alert('Escaped HTML code found');
          return false;
        }

        return true;
      };
    </script>
  </body>
</html>
