#!/bin/sh -e
#from http://www.kerneltrap.org/mailarchive/git/2009/1/9/4654694
#modified by n1k and kzar

: ${GIT_CACHE_META_FILE=.git_cache_meta}
case $@ in
    --store|--stdout)
    case $1 in --store) exec > $GIT_CACHE_META_FILE; esac
    find releases/ -type f \
        \( -printf 'touch -d "%TY-%Tm-%Td %TH:%TM:%TS" %p\n' \) | sort ;;
    --apply) sh -e $GIT_CACHE_META_FILE;;
    *) 1>&2 echo "Usage: $0 --store|--stdout|--apply"; exit 1;;
esac
