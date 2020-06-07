#!/bin/bash
set -e

THIS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
TARGET=/var/www

cd $THIS_DIR/client
rm -f dist/*

npm install
npm run-script build
mv $TARGET/html $TARGET/html.old
cp -r dist $TARGET/html

cp -r $THIS_DIR/server/data /var/www
