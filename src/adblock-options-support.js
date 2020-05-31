'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global browser, backgroundPage, selected, browser */

$(() => {
  if (navigator.language.substring(0, 2) !== 'en') {
    $('.english-only').removeClass('do-not-display');
  }
  // Show debug info
  selected('#debug', () => {
    let debugInfo = null;
    const showDebugInfo = function () {
      $('#debugInfo').text(debugInfo)
        .css({ width: '450px', height: '100px' })
        .fadeIn();
    };
    // Get debug info
    backgroundPage.getDebugInfo((theDebugInfo) => {
      const content = [];
      if (theDebugInfo.subscriptions) {
        content.push('=== Filter Lists ===');
        for (const sub in theDebugInfo.subscriptions) {
          content.push(`Id:${sub}`);
          content.push(`  Download Count: ${theDebugInfo.subscriptions[sub].downloadCount}`);
          content.push(`  Download Status: ${theDebugInfo.subscriptions[sub].downloadStatus}`);
          content.push(`  Last Download: ${theDebugInfo.subscriptions[sub].lastDownload}`);
          content.push(`  Last Success: ${theDebugInfo.subscriptions[sub].lastSuccess}`);
        }
      }

      content.push('');

      // Custom & Excluded filters might not always be in the object
      if (theDebugInfo.customFilters) {
        content.push('=== Custom Filters ===');
        content.push(theDebugInfo.customFilters);
        content.push('');
      }

      if (theDebugInfo.exclude_filters) {
        content.push('=== Exclude Filters ===');
        content.push(JSON.stringify(theDebugInfo.exclude_filters));
      }

      content.push('=== Settings ===');
      for (const setting in theDebugInfo.settings) {
        content.push(`${setting} : ${theDebugInfo.settings[setting]}`);
      }

      content.push('');
      content.push('=== Other Info ===');
      content.push(JSON.stringify(theDebugInfo.otherInfo, null, '\t'));

      // Put it together to put into the textbox
      debugInfo = content.join('\n');

      if (
        browser.runtime.getManifest().optional_permissions
        && browser.runtime.getManifest().optional_permissions.includes('management')
      ) {
        browser.permissions.request({
          permissions: ['management'],
        }).then((granted) => {
          // The callback argument will be true if the user granted the permissions.
          if (granted) {
            // since the management.getAll function is not available when the page is loaded
            // the function is not wrapped by the polyfil Promise wrapper
            // so we create, and load a temporary iFrame after the permission is granted
            // so the polyfil will correctly wrap the now available API
            const iframe = document.createElement('iframe');
            iframe.onload = () => {
              const proxy = iframe.contentWindow.browser;
              proxy.management.getAll().then((result) => {
                const extInfo = [];
                extInfo.push('==== Extension and App Information ====');
                for (let i = 0; i < result.length; i++) {
                  extInfo.push(`Number ${i + 1}`);
                  extInfo.push(`  name: ${result[i].name}`);
                  extInfo.push(`  id: ${result[i].id}`);
                  extInfo.push(`  version: ${result[i].version}`);
                  extInfo.push(`  enabled: ${result[i].enabled}`);
                  extInfo.push(`  type: ${result[i].type}`);
                  extInfo.push('');
                }

                debugInfo = `${debugInfo}  \n\n${extInfo.join('  \n')}`;
                showDebugInfo();
                browser.permissions.remove({ permissions: ['management'] });
                document.body.removeChild(iframe);
              });
            };
            iframe.src = browser.runtime.getURL('proxy.html');
            iframe.style.visibility = 'hidden';
            document.body.appendChild(iframe);
          } else {
            debugInfo += '\n\n==== User Denied Extension and App Permissions ====';
            showDebugInfo();
          }
        });
      } else {
        debugInfo += '\n\n==== No Extension and App Information ====';
        showDebugInfo();
      }
    });
  });

  // Show the changelog
  selected('#whatsnew_link', () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', browser.runtime.getURL('CHANGELOG.txt'), false);
    xhr.send();
    const object = xhr.responseText;
    $('#changes').text(object).css({ width: '670px', height: '200px' }).fadeIn();
    $('body, html').animate({
      scrollTop: $('#changes').offset().top,
    }, 1000);
  });
});
