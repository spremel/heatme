#!/bin/bash

function error {
    >&2 echo "ERROR: $1"
}

if [[ $# -lt 1 ]]; then
    error "Missing input directory"
    exit -1
fi

ofilename=data/test/constance.gpx
rm -f $ofilename

echo '<?xml version="1.0" encoding="UTF-8"?>' >> $ofilename
echo '<gpx version="1.0" creator="custom" xmlns="http://www.topografix.com/GPX/1/0">' >> $ofilename
for ifilename in $(find $1 -name "*.fit.gz"); do
    # name=$(basename ${ifilename%.fit.gz})
    gpsbabel -i garmin_fit -o gpx -f <(zcat $ifilename) -F - | sed -En '/^[[:space:]]+<trkpt/p' | sed -E 's|[[:space:]]+<trkpt(.*)>|  <wpt\1/>|' >> $ofilename
    if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
        error "Failed to convert $ifilename"
    fi
done
echo '</gpx>' >> $ofilename
