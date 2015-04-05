"use strict";

var run_bandaids = function () {
    // Tests to determine whether a particular bandaid should be applied
    var apply_bandaid_for = "";
    if (/mail\.live\.com/.test(document.location.hostname))
        apply_bandaid_for = "hotmail";
    else if (/getadblock\.com$/.test(document.location.hostname) &&
        window.top === window.self)
        apply_bandaid_for = "getadblock";
    else if (/mobilmania\.cz|zive\.cz|doupe\.cz|e15\.cz|sportrevue\.cz|autorevue\.cz/.test(document.location.hostname))
        apply_bandaid_for = "czech_sites";
    else {
        var hosts = [/mastertoons\.com$/];
        hosts = hosts.filter(function (host) {
            return host.test(document.location.hostname);
        });
        if (hosts.length > 0)
            apply_bandaid_for = "noblock";
    }

    var bandaids = {
        noblock: function () {
            var styles = document.querySelectorAll("style");
            var re = /#(\w+)\s*~\s*\*\s*{[^}]*display\s*:\s*none/;
            for (var i = 0; i < styles.length; i++) {
                var id = styles[i].innerText.match(re);
                if (id) {
                    styles[i].innerText = '#' + id[1] + ' { display: none }';
                }
            }
        },
        hotmail: function () {
            //removing the space remaining in Hotmail/WLMail
            var el = document.querySelector(".Unmanaged .WithSkyscraper #MainContent");
            if (el) {
                el.style.setProperty("margin-right", "1px", null);
            }
            el = document.querySelector(".Managed .WithSkyscraper #MainContent");
            if (el) {
                el.style.setProperty("right", "1px", null);
            }
            el = document.getElementById("SkyscraperContent");
            if (el) {
                el.style.setProperty("display", "none", null);
                el.style.setProperty("position", "absolute", null);
                el.style.setProperty("right", "0px", null);
            }
        },
        getadblock: function () {
            BGcall('get_adblock_user_id', function (adblock_user_id) {
                var elemDiv = document.createElement("div");
                elemDiv.id = "adblock_user_id";
                elemDiv.innerText = adblock_user_id;
                elemDiv.setAttribute('data-adblock_user_id', adblock_user_id);
                elemDiv.style.display = "none";
                document.body.appendChild(elemDiv);
            });
            BGcall('get_first_run', function (first_run) {
                var elemDiv = document.createElement("div");
                elemDiv.id = "adblock_first_run_id";
                elemDiv.innerText = first_run;
                elemDiv.setAttribute('data-adblock_first_run_id', first_run);
                elemDiv.style.display = "none";
                document.body.appendChild(elemDiv);
            });
            BGcall('set_first_run_to_false', null);
        },
        czech_sites: function () {
            var player = document.getElementsByClassName("flowplayer");
            // Remove data-ad attribute from videoplayer
            if (player) {
                for (var i = 0; i < player.length; i++)
                    player[i].removeAttribute("data-ad");
            }
        },
    }; // end bandaids

    if (apply_bandaid_for) {
        bandaids[apply_bandaid_for]();
    }
};

var before_ready_bandaids = function () {
    // Tests to determine whether a particular bandaid should be applied
    var apply_bandaid_for = "";

    if (apply_bandaid_for) {
        bandaids[apply_bandaid_for]();
    }
};