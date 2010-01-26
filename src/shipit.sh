grep 'debug_id.*true;' functions.js && {
  echo "Fix debug_id, stupid"
  exit 1
}

cd $(dirname $0)

curl http://adblockplus.mozdev.org/easylist/easylist.txt > filters/easylist.txt

svn diff filters/easylist.txt | grep '^[+-]'
echo

rm -f ../adblock_for_chrome.zip && (cd ..; zip -x '*/.svn/*' -x '*/dev/*' -r adblock_for_chrome.zip adblock_for_chrome/)
