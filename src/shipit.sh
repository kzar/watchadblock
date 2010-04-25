grep 'debug_id.*true;' functions.js && {
  echo "Fix debug_id, stupid"
  exit 1
}

cd $(dirname $0)

curl http://adblockplus.mozdev.org/easylist/easylist.txt > filters/easylist.txt

svn diff filters/easylist.txt | grep '^[+-]'
echo

thisdir=$(basename $(pwd)) # works whether we check out as trunk or afc or...
rm -f ../adblockforchrome.zip && (cd ..; zip -x '*/.svn/*' -x '*/dev/*' -r adblockforchrome.zip $thisdir/)
