#!/bin/bash
set -e

THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
TARGET=/var/www/html

cd $THIS_DIR/client
rm -f dist/*

npm install
npm run-script build
mv $TARGET $TARGET.old
cp -r dist $TARGET
cp -r $THIS_DIR/server/data $TARGET
