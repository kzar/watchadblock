'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global chrome, translate, Prefs, storageGet, localizePage, storageSet,
  selected, selectedOnce, showHelpSetupPage, i18nJoin */

let errorOccurred = false;

const processError = function (err, stack, message) {
  const errorPayload = {
    u: 'unknown',
    f: 'e',
    o: 'unknown',
    l: 'unknown',
    t: 'error',
    st: 'popupmenu',
  };

  const sendErrorPayload = function () {
    const payload = { event: 'error', payload: errorPayload };
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://log.getadblock.com/v2/record_log.php', true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.send(JSON.stringify(payload));
  };

  // the translation messages are hard code in the JS to avoid any dependency
  // on Chrome extension APIs during error handling
  const translateErrorMsg = function (key) {
    const text = {
      error_msg_header: {
        en: "Oops! We're sorry, the AdBlock menu had trouble loading.",
      },
      error_msg_help_us: {
        en: 'Help us resolve this problem by sending us some debug data: Click ',
      },
      error_msg_thank_you: {
        en: 'Thank you',
      },
      error_msg_reload: {
        en: 'Next, try reloading the extension: Click ',
      },
      error_msg_help: {
        en: "If that doesn't work, check here for more help: Click ",
      },
      error_msg_here: {
        en: 'here',
      },
    };
    const locale = navigator.language.substring(0, 2);
    const msg = text[key] || {};
    return msg[locale] || msg.en;
  };

  errorOccurred = true;
  errorPayload.msg = err.message || message || 'no message';
  errorPayload.src = err.source || stack || 'no source';
  errorPayload.line = err.lineno || 'anywhere';
  errorPayload.col = err.colno || 'anywhere';
  errorPayload.err = err.error || 'no error';
  if (typeof err === 'string') {
    errorPayload.msg = err;
  }
  const errorMsgDiv = document.getElementById('div_status_error');
  if (errorMsgDiv) {
    selectedOnce(document.getElementById('errorreport'), () => {
      sendErrorPayload();
      const firstMsg = document.getElementById('first_msg');
      firstMsg.style.display = 'none';
      const secondMsg = document.getElementById('second_msg');
      secondMsg.style.display = 'block';
    });

    const reloadAnchor = document.getElementById('reload');
    if (chrome && chrome.runtime && chrome.runtime.reload) {
      selectedOnce(reloadAnchor, () => {
        try {
          chrome.runtime.reload();
        } catch (e) {
          const reloadMsg = document.getElementById('reload_msg');
          if (reloadMsg) {
            reloadMsg.style.display = 'none';
          }
          const thirdMsg = document.getElementById('third_msg');
          if (thirdMsg) {
            thirdMsg.style.display = 'block';
          }
        }
      });
    } else {
      reloadAnchor.style.display = 'none';
    }

    document.querySelectorAll('.menu-entry').forEach((el) => {
      const elem = el;
      elem.style.display = 'none';
    });

    document.querySelectorAll('.separator').forEach((el) => {
      const elem = el;
      elem.style.display = 'none';
    });

    const headerIconsDiv = document.getElementById('header-icons');
    if (headerIconsDiv) {
      headerIconsDiv.style.display = 'none';
    }

    const divSlideoutDiv = document.getElementById('div_slideout');
    if (divSlideoutDiv) {
      divSlideoutDiv.style.display = 'none';
    }

    document.querySelectorAll("*[i18n_error^='error_msg']").forEach((el) => {
      const elem = el;
      elem.innerText = translateErrorMsg(elem.getAttribute('i18n_error'));
    });

    errorMsgDiv.style.display = 'block';
  }
};

let BG = null;
let page = null;

try {
  BG = chrome.extension.getBackgroundPage();
  const { License } = BG;
  const { SyncService } = BG;
  const { Prefs } = BG;
  const userClosedCta = storageGet(License.popupMenuCtaClosedKey);
  const showThemesCTA = storageGet(License.showPopupMenuThemesCtaKey);
  const shown = {};

  // the tab/page object, which contains |id| and |url| of
  // the current tab
  let pageInfo = null;
  let activeTab = null;
  let popupMenuTheme = 'default_theme';
  let themeCTA = '';
  let itemClicked = false;

  const show = function (elementIds) {
    elementIds.forEach((elementId) => {
      shown[elementId] = true;
    });
  };

  const hide = function (elementIds) {
    elementIds.forEach((elementId) => {
      shown[elementId] = false;
    });
  };

  $(() => {
    // We needed to reload popover in Safari, so that we could
    // update popover according to the status of AdBlock.
    // We don't need to reload popup in Chrome because Chrome
    // reloads every time the popup for us.
    // Leaving the behavior centralized just in case Chrome changes.
    function closeAndReloadPopup() {
      itemClicked = true;
      window.close();
    }

    try {
      // For better accessibility on pause/resume actions
      let ariaLabel = i18nJoin('pause_on_this_site', 'adblock_will_pause_on_this_site');
      $('#div_domain_pause_adblock').attr('aria-label', ariaLabel);
      ariaLabel = i18nJoin('pause_on_all_sites', 'adblock_will_pause_on_all_sites');
      $('#div_pause_adblock').attr('aria-label', ariaLabel);
      ariaLabel = i18nJoin('resume_blocking_ads_period', 'adblock_will_block_ads_again');
      $('#div_domain_paused_adblock').attr('aria-label', ariaLabel);
      $('#div_paused_adblock').attr('aria-label', ariaLabel);

      localizePage();

      // Set menu entries appropriately for the selected tab.
      $('.menu-entry, .menu-status, .separator').hide();
      BG.recordGeneralMessage('popup_opened');

      BG.getCurrentTabInfo((info) => {
        try {
          License.showIconBadgeCTA(false);

          if (info.settings) {
            popupMenuTheme = info.settings.color_themes.popup_menu;
          }
          $('body').attr('id', popupMenuTheme).data('theme', popupMenuTheme);

          if (info && info.errorStr) {
            processError(info.errorStr, info.stack, info.message);
            return;
          }
          $(window).unload(() => {
            if (!itemClicked) {
              BG.recordGeneralMessage('popup_closed');
            }
          });

          // Cache tab object for later use
          ({ page } = info);
          pageInfo = info;
          const paused = BG.adblockIsPaused();
          const domainPaused = BG.adblockIsDomainPaused({ url: page.url.href, id: page.id });

          show(['svg_options']);
          if (paused) {
            show(['div_status_paused', 'separator0', 'div_paused_adblock', 'svg_options', 'help_link']);
          } else if (domainPaused) {
            show(['div_status_domain_paused', 'separator0', 'div_domain_paused_adblock', 'svg_options', 'help_link']);
          } else if (info.disabledSite) {
            show(['div_status_disabled', 'separator0', 'div_pause_adblock', 'svg_options', 'help_link']);
          } else if (info.whitelisted) {
            show(['div_status_whitelisted', 'div_enable_adblock_on_this_page', 'separator0', 'div_pause_adblock', 'svg_options', 'help_link']);
          } else {
            show(['div_pause_adblock', 'div_domain_pause_adblock', 'div_blacklist', 'div_whitelist', 'div_whitelist_page', 'separator3', 'separator4', 'svg_options', 'block_counts', 'help_link']);

            chrome.runtime.sendMessage({
              type: 'stats.getBlockedPerPage',
              tab: info.tab,
            }).then((blockedPage) => {
              $('#page_blocked_count').text(blockedPage.toLocaleString());
            });
            $('#total_blocked_count').text(Prefs.blocked_total.toLocaleString());
          }

          const host = page.url.hostname;
          const disabledOrWhitelisted = info.disabledSite || !info.whitelisted;
          const eligibleForUndo = !paused && !domainPaused && disabledOrWhitelisted;
          const urlToCheckForUndo = info.disabledSite ? undefined : host;
          if (eligibleForUndo && BG.countCache.getCustomFilterCount(urlToCheckForUndo)) {
            show(['div_undo', 'separator0']);
          }

          if (
            host === 'www.youtube.com'
            && info.youTubeChannelName
            && /ab_channel/.test(page.url.href)
            && eligibleForUndo
          ) {
            $('#div_whitelist_channel').text(translate('whitelist_youtube_channel', info.youTubeChannelName));
            show(['div_whitelist_channel']);
          }

          if (chrome.runtime && chrome.runtime.id === 'pljaalgmajnlogcgiohkhdmgpomjcihk') {
            show(['div_status_beta']);
          }

          // Premium CTAs
          if (License.shouldShowMyAdBlockEnrollment() && userClosedCta && showThemesCTA) {
            show(['div_premium_themes_cta']);
            themeCTA = License.getCurrentPopupMenuThemeCTA();
            $('#div_premium_themes_cta').attr('data-theme-cta', themeCTA);
            BG.recordGeneralMessage(
              'premium_themes_cta_seen',
              undefined,
              { theme: themeCTA.replace('_theme', '') },
            );
          } else if (License.shouldShowMyAdBlockEnrollment() && !userClosedCta) {
            show(['div_myadblock_enrollment_v2', 'separator-1', 'separator-2']);
          }

          if (shown.block_counts && Prefs.show_statsinpopup) {
            hide(['separator-1']);
          } else if (info.disabledSite || info.whitelisted) {
            hide(['separator-2']);
          }

          if (
            info.settings.sync_settings
            && SyncService.getLastGetStatusCode() === 400
            && SyncService.getLastGetErrorResponse()
            && SyncService.getLastGetErrorResponse().code === 'invalid_sync_version'
          ) {
            show(['div_sync_outofdate_error_msg']);
            SyncService.resetLastGetStatusCode(); // reset the code, so it doesn't show again.
            SyncService.resetLastGetErrorResponse(); // reset the code, so it doesn't show again.
          } else if (
            // eslint-disable-next-line max-len
            (SyncService.getLastPostStatusCode() >= 400 || SyncService.getLastPostStatusCode() === 0)
            && info.settings.sync_settings
          ) {
            show(['div_sync_error_msg']);
            SyncService.resetLastPostStatusCode(); // reset the code, so it doesn't show again.
          } else {
            hide(['div_sync_error_msg']);
          }

          if (info.settings.show_protect_enrollment) {
            show(['div_adblock_protect_enrollment']);
            hide(['separator0']);
            $('#block_counts').addClass('remove-bottom-margin');
          }

          if (errorOccurred) {
            return;
          }
          for (const div in shown) {
            if (shown[div]) {
              $(`#${div}`).show();
            }
          }

          if (
            !Prefs.show_statsinpopup
            || paused
            || domainPaused
            || info.disabledSite
            || info.whitelisted
          ) {
            $('#block_counts').hide();
          }

          // Add padding at the end of the Pop-up menu
          $('.menu-entry:not(.premium-cta):visible').last().addClass('last-item');
        } catch (err) {
          processError(err);
        }
      });

      // Click handlers
      selected('#bugreport', () => {
        BG.recordGeneralMessage('bugreport_clicked');
        const supportURL = 'https://help.getadblock.com/support/tickets/new';
        BG.openTab(supportURL);
        closeAndReloadPopup();
      });

      selected('.header-logo', () => {
        BG.recordGeneralMessage('titletext_clicked');
        const chromeUrl = 'https://chrome.google.com/webstore/detail/gighmmpiobklfepjocnamgkkbiglidom';
        BG.openTab(chromeUrl);

        closeAndReloadPopup();
      });

      selected('#div_enable_adblock_on_this_page', () => {
        BG.recordGeneralMessage('enable_adblock_clicked');
        if (BG.tryToUnwhitelist(page.url.href)) {
          chrome.tabs.reload();
          closeAndReloadPopup();
        } else {
          $('#div_status_whitelisted').replaceWith(translate('disabled_by_filter_lists'));
        }
      });

      selected('#div_paused_adblock', () => {
        BG.recordGeneralMessage('unpause_clicked');
        BG.adblockIsPaused(false);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
      });

      selected('#div_domain_paused_adblock', () => {
        BG.recordGeneralMessage('domain_unpause_clicked');
        BG.adblockIsDomainPaused({ url: page.url.href, id: page.id }, false);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
      });

      selected('#div_undo', () => {
        BG.recordGeneralMessage('undo_clicked');
        const host = page.url.hostname;
        activeTab = page;
        BG.confirmRemovalOfCustomFiltersOnHost(host, activeTab);
        closeAndReloadPopup();
      });

      selected('#div_whitelist_channel', () => {
        BG.recordGeneralMessage('whitelist_youtube_clicked');
        BG.createWhitelistFilterForYoutubeChannel(page.url.href);
        closeAndReloadPopup();
        chrome.tabs.reload();
      });

      selected('#div_pause_adblock', () => {
        BG.recordGeneralMessage('pause_clicked');
        try {
          if (pageInfo.settings.safari_content_blocking) {
            // eslint-disable-next-line no-alert
            alert(translate('safaricontentblockingpausemessage'));
          } else {
            BG.adblockIsPaused(true);
            BG.updateButtonUIAndContextMenus();
          }

          closeAndReloadPopup();
        } catch (ex) {
          BG.log(ex);
        }
      });

      selected('#div_domain_pause_adblock', () => {
        BG.recordGeneralMessage('domain_pause_clicked');
        BG.adblockIsDomainPaused({ url: page.url.href, id: page.id }, true);
        BG.updateButtonUIAndContextMenus();
        closeAndReloadPopup();
      });

      selected('#div_blacklist', () => {
        BG.recordGeneralMessage('blacklist_clicked');
        BG.emitPageBroadcast({
          fn: 'topOpenBlacklistUI',
          options: {
            nothingClicked: true,
            isActiveLicense: License.isActiveLicense(),
            showBlacklistCTA: License.shouldShowBlacklistCTA(),
          },
        }, {
          tab: page,
        }); // fake sender to determine target page

        closeAndReloadPopup();
      });

      selected('#div_whitelist', () => {
        BG.recordGeneralMessage('whitelist_domain_clicked');
        BG.emitPageBroadcast({
          fn: 'topOpenWhitelistUI',
          options: {},
        }, {
          tab: page,
        }); // fake sender to determine target page

        closeAndReloadPopup();
      });

      selected('#div_whitelist_page', () => {
        BG.recordGeneralMessage('whitelist_page_clicked');
        BG.createPageWhitelistFilter(page.url.href);
        closeAndReloadPopup();
        chrome.tabs.reload();
      });

      selected('#svg_options', () => {
        BG.recordGeneralMessage('options_clicked');
        BG.openTab(chrome.runtime.getURL('options.html'));
        closeAndReloadPopup();
      });

      selected('#div_myadblock_enrollment_v2', () => {
        BG.recordGeneralMessage('myadblock_cta_clicked');
        BG.openTab(License.MAB_CONFIG.payURL);
        closeAndReloadPopup();
      });

      selected('#mabNewCtaClose', (event) => {
        event.stopPropagation();
        BG.recordGeneralMessage('myadblock_cta_closed');
        $('#div_myadblock_enrollment_v2').slideUp();
        $('#separator-2').hide();
        storageSet(License.popupMenuCtaClosedKey, true);
        storageSet(License.showPopupMenuThemesCtaKey, true);
      });

      selected('#div_premium_themes_cta', (event) => {
        event.stopPropagation();
        const theme = themeCTA ? themeCTA.replace('_theme', '') : '';
        BG.recordGeneralMessage('premium_themes_cta_clicked', undefined, { theme });
        BG.openTab(chrome.runtime.getURL('options.html#mab-themes'));
        closeAndReloadPopup();
      });

      selected('#close-themes-cta', (event) => {
        event.stopPropagation();
        const theme = themeCTA ? themeCTA.replace('_theme', '') : '';
        BG.recordGeneralMessage('premium_themes_cta_closed', undefined, { theme });
        $('#div_premium_themes_cta').slideUp();
        storageSet(License.showPopupMenuThemesCtaKey, false);
      });

      selected('#help_link', () => {
        BG.recordGeneralMessage('feedback_clicked');
        if (!pageInfo.disabledSite) {
          showHelpSetupPage();
        } else {
          BG.openTab('http://help.getadblock.com/');
        }
      });

      selected('#protect_enrollment_btn', () => {
        BG.recordGeneralMessage('protect_enrollment_btn_clicked');
        BG.setSetting('show_protect_enrollment', false);
        BG.openTab('https://chrome.google.com/webstore/detail/adblock-protect/fpkpgcabihmjieiegmejiloplfdmpcee');
        closeAndReloadPopup();
      });

      $('#div_myadblock_enrollment_v2').hover(() => {
        $('#separator-1').addClass('hide-on-new-cta-hover');
        $('#separator-2').addClass('hide-on-new-cta-hover');
        $('#separator0').addClass(shown.separator0 ? 'hide-on-new-cta-hover' : '');
        $('#mabNewCtaText').text(translate('new_cta_hovered_text'));
      }, () => {
        $('#separator-1').removeClass('hide-on-new-cta-hover');
        $('#separator-2').removeClass('hide-on-new-cta-hover');
        $('#separator0').removeClass('hide-on-new-cta-hover');
        $('#mabNewCtaText').text(translate('new_cta_default_text'));
      });

      $('#div_premium_themes_cta').hover(
        function handleIn() {
          $('#themes-cta-text').text(translate('check_out_themes'));
          const currentThemeCTA = $(this).attr('data-theme-cta');
          $('body').attr('id', currentThemeCTA).data('theme', currentThemeCTA);
        },
        // eslint-disable-next-line prefer-arrow-callback
        function handleOut() {
          $('#themes-cta-text').text(translate('adblock_looked_like_this'));
          $('body').attr('id', popupMenuTheme).data('theme', popupMenuTheme);
        },
      );
    } catch (err) {
      processError(err);
    }
  });
} catch (err) {
  processError(err);
}
