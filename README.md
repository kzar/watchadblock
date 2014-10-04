# watchadblock

## Intro

[Adblock](https://chrome.google.com/webstore/detail/adblock/gighmmpiobklfepjocnamgkkbiglidom?hl=en) is an opensource Chrome extension that aims to block adverts. Until December 2013 it was developed quite openly but more recently the development process has been hidden somewhat from the public. Releases are [still posted on their website](http://code.getadblock.com/releases/?C=M;O=D) but the changes are not under publicly accessible source control.

As [the SVN repository](http://adblockforchrome.googlecode.com/svn/) used up until recently is (at the time of writing) still online I have decided to import it here, to GitHub, for easier access. During the import process I moved the code into the `src/` subdirectory but I have otherwise tried to keep an accurate representation of the SVN history. I have tried my best, but it is possible I have made mistakes as this isn't a simple process. Also it should be said that this repository has nothing to do with the Adblock developers, it is unofficial.

Since there is no development history from 2.6.5 onwards currently available I have written a script to import each new release zip automatically. Hopefully if all is well this repository will be kept quite up to date and will provide a quick way to see how the code has been changing between versions. (There are [some other similar projects](https://github.com/search?utf8=%E2%9C%93&q=getadblock) run by other people as well, if this repository becomes out of date perhaps try them.)

If you're interested in why the lack of transparency during development is a problem [Wladimir wrote an article about the subject recently](https://palant.de/2014/07/29/which-is-better-adblock-or-adblock-plus). Finally, in the interests of transparency, I should mention that I am currently working with [Eyeo GmbH](https://eyeo.com) and Wladimir on [Adblock Plus](http://adblockplus.org) which is a competing product.

## Usage

Just browse through the code in the `src/` directory or have a look back through the commit history to see what has changed and when.

The wiki from https://code.google.com/p/adblockforchrome/ has also been imported, you can [view the content in this repository's wiki](https://github.com/kzar/watchadblock/wiki).

If you want to run your own mirror set up a cronjob to run `bin/update` after cloning. (But be careful to make sure that the cronjob cds into the root of the repo directory first and also make sure to set up Git on the server / machine you'll be running this on. Also please note the script is rough and ready, I would check it before running.)
