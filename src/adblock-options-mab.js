'use strict';

/* For ESLint: List any global identifiers used in this file below */
/* global License, MABPayment, localizePage, activateTab, translate, backgroundPage */

$(() => {
  localizePage();

  if (!License || $.isEmptyObject(License) || !MABPayment) {
    return;
  }

  const payInfo = MABPayment.initialize('mab');
  const $pageTitle = $('#premium-tab-header > h1.page-title');
  let manageSubscriptionURL = License.MAB_CONFIG.subscriptionURL;

  if (License.shouldShowMyAdBlockEnrollment()) {
    MABPayment.freeUserLogic(payInfo);
    $pageTitle.text(translate('premium_page_title'));
  } else if (License.isActiveLicense()) {
    MABPayment.paidUserLogic(payInfo);
    $pageTitle.text(translate('premium'));

    if (License.isLicenseCodeValid()) {
      manageSubscriptionURL = `${manageSubscriptionURL}?lic=${License.get().code}`;
    }
    $('a#manage-subscription').attr('href', manageSubscriptionURL).show();
  }

  $('.mab-feature:not(.locked) a').on('click', function goToTab() {
    activateTab($(this).attr('href'));
  });

  if (backgroundPage && backgroundPage.getSettings()) {
    const optionsTheme = backgroundPage.getSettings().color_themes.options_page;
    if (optionsTheme === 'dark_theme') {
      $('#themes-preview').attr('src', 'icons/themes_lighttext.svg');
    } else {
      $('#themes-preview').attr('src', 'icons/themes_darktext.svg');
    }
  }
});
