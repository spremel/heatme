<template>
<b-container fluid>
  <MapSettings></MapSettings>
  <div id="map">
    <b-button id="button-settings" v-b-toggle.sidebar-settings size="sm">
      <b-icon icon="gear-fill" aria-hidden="true"></b-icon>
    </b-button>
  </div>
</b-container>
</template>

<script>

import {ORIGIN_SERVER} from '@/constants.js'
import MapSettings from '@/views/MapSettings'
import 'ol/ol.css'

// import GPXWithId from '@/format/format.js'
const customFormat = require('@/format/format.js')

var ol = require('ol')
ol.source = require('ol/source')
ol.format = require('ol/format')
ol.layer = require('ol/layer')
ol.proj = require('ol/proj')
ol.extent = require('ol/extent')
ol.loadingstrategy = require('ol/loadingstrategy')
ol.coordinate = require('ol/coordinate')

const querystring = require('querystring')

export default {
  name: 'Map',
  data () {
    return {
      athlete: this.$route.params.athleteId,
      loading: true
    }
  },
  components: { MapSettings },
  mounted () {
    var activityTypes = []
    var dateAfter = null
    var dateBefore = null

    var vectorSource = new ol.source.Vector({
      strategy: ol.loadingstrategy.bbox,
      url: (extent, resolution, projection) => {
        var extent4326 = [
          ol.proj.transform(ol.extent.getBottomLeft(extent), 'EPSG:3857', 'EPSG:4326'),
          ol.proj.transform(ol.extent.getTopLeft(extent), 'EPSG:3857', 'EPSG:4326'),
          ol.proj.transform(ol.extent.getTopRight(extent), 'EPSG:3857', 'EPSG:4326'),
          ol.proj.transform(ol.extent.getBottomRight(extent), 'EPSG:3857', 'EPSG:4326')
        ]

        var longitudes = extent4326.map(e => { return e[0] })
        var latitudes = extent4326.map(e => { return e[1] })

        var filters = {
          'latmin': Math.min(...latitudes).toFixed(6),
          'latmax': Math.max(...latitudes).toFixed(6),
          'lngmin': Math.min(...longitudes).toFixed(6),
          'lngmax': Math.max(...longitudes).toFixed(6)
        }

        filters.athletes = [this.athlete].join(',')

        if (activityTypes.length) {
          filters.types = activityTypes.join(',')
        }

        if (dateAfter) {
          filters.after = ~~(dateAfter.getTime() / 1000)
        }

        if (dateBefore) {
          filters.before = ~~(dateBefore.getTime() / 1000)
        }

        var url = `${ORIGIN_SERVER}/data?${querystring.stringify(filters)}`
        console.log('Url: ' + url)

        return url
      },

      format: new customFormat.GPXWithId()
    })

    var heatmap = new ol.layer.Heatmap({
      source: vectorSource
    })

    var raster = new ol.layer.Tile({
      source: new ol.source.OSM()
    })

    var map = new ol.Map({
      layers: [raster, heatmap],
      target: 'map',
      view: new ol.View({
        center: [239655, 6242334],
        zoom: 5
      })
    })

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var currentPosition = ol.proj.transform([pos.coords.longitude, pos.coords.latitude], 'EPSG:4326', 'EPSG:3857')
          map.getView().setCenter(currentPosition)
        }
      )
    }

    this.$root.$on('heatmap-blur-changed', value => { heatmap.setBlur(value) })
    this.$root.$on('heatmap-radius-changed', value => { heatmap.setRadius(value) })
    this.$root.$on('filter-type-changed', value => { activityTypes = value; vectorSource.refresh() })
    this.$root.$on('filter-date-after-changed', value => { dateAfter = value; vectorSource.refresh() })
    this.$root.$on('filter-date-before-changed', value => { dateBefore = value; vectorSource.refresh() })

    this.$root.$on('map-source-changed', value => {
      let source = null

      if (['stamen-toner', 'stamen-terrain'].includes(value)) {
        source = new ol.source.Stamen({
          layer: {
            'stamen-toner': 'toner',
            'stamen-terrain': 'terrain'
          }[value]
        })
      } else if (['bing-road', 'bing-road-dark'].includes(value)) {
        source = new ol.source.BingMaps({
          key: 'Ag6xa_H_HmbKgcJ1yYwO0Qel03XQVdT2cZ38TWLEbnIhOFMORRUwzNhFgaCke7lu',
          imagerySet: {
            'bing-road': 'RoadOnDemand',
            'bing-road-dark': 'CanvasDark'
          }[value]
        })
      } else {
        source = new ol.source.OSM()
      }

      raster.setSource(source)
    })

    this.$root.$emit('map-mounted')
  }
}
</script>

<style scoped>
.ol-control {
    position: fixed;
}

.ol-zoom {
    left: unset;
    right: 5em;
}

#map {
    height: 100%;
    width: 100%;
    position:fixed;
    padding-right: 20px;
    padding-bottom: 10px;
}

#button-settings {
    position: absolute;
    top: 95%;
    left: 0%;
    z-index: 1;
    transform: translate(0%, -10%);
    margin-left: 10px;
}

</style>
