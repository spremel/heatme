#!/bin/sh

if [ $(whoami) != 'root' ]; then
  2>&1 echo 'must be started as root'
  exit 1
fi

processes="server.js monitoring.js"

nginx -s reload
for process in $processes; do
  pid=$(ps axu | grep -i $process | grep -v grep | awk '{print $2}')

  if [ "$pid" != '' ]; then
    echo "Removing previous process $process ($pid)"
    kill $pid
  fi
  echo "Starting process $process"
  node server/$process > /tmp/heatme-$process.log 2>&1 &
done


