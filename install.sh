#!/bin/bash
set -e

if [[ $EUID -ne 0 ]]; then
   1>&2 echo "This script must be run as root" 
   exit 1
fi

THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
TARGET=/var/www/html

cd $THIS_DIR/client
rm -rf dist/*
# npm install
npm run build
rm -rf $TARGET.old
mv $TARGET $TARGET.old
cp -r dist $TARGET
