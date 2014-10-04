#!/usr/bin/perl
# Convert Crowdin exported folder structure into AdBlock's structure
#
# Before running this script, delete the contents of _locales/ and copy
# over the new translations from the proper folder in Crowdin's exported
# zip file.

use FindBin;
use File::Path;

# path to where the locales folder is
# needs a trailing slash
$path = "$FindBin::Bin/../_locales/";

# store list of locale folders in array
opendir(LOCALES,$path);
@localefolders = readdir(LOCALES);
closedir(LOCALES);

# rename folders for languages that don't have several variants
# e.g. en_US becomes en, unless there are other variants like en_GB
foreach $folder (@localefolders){
	if ((-d $path.$folder) && ($folder =~ /^[a-z]{2}_[A-Z]{2}$/)){
		$language = substr($folder,0,2);
		@variants = grep(/^$language/,@localefolders);
		if ($#variants == 0){
			rename($path.$folder,$path.$language);
		}
	}
}


# apparently Chrome absolutely wants Norwegian to be nb
if (-d $path."no"){
	rename($path."no",$path."nb");
}