<template>
<b-container fluid>
  <b-row>
    <b-col>
      <MapSettings></MapSettings>
    </b-col>
    <b-col cols=10 align-self="end">
      <div id="map" class="map"></div>
    </b-col>
  </b-row>
</b-container>
</template>

<script>

import MapSettings from '@/views/MapSettings'
import 'ol/ol.css'

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
      athlete: this.$route.params.athleteId
    }
  },
  components: { MapSettings },
  mounted () {
    // var serverIp = '35.210.237.237'
    var serverIp = 'localhost:8080'

    var vectorSource = new ol.source.Vector({
      strategy: ol.loadingstrategy.bbox,
      url: function (extent, resolution, projection) {
        console.log('Extent: ' + extent)
        console.log('Resolution: ' + resolution)

        var extent4326 = [
          ol.proj.transform(ol.extent.getBottomLeft(extent), 'EPSG:3857', 'EPSG:4326'),
          ol.proj.transform(ol.extent.getTopLeft(extent), 'EPSG:3857', 'EPSG:4326'),
          ol.proj.transform(ol.extent.getTopRight(extent), 'EPSG:3857', 'EPSG:4326'),
          ol.proj.transform(ol.extent.getBottomRight(extent), 'EPSG:3857', 'EPSG:4326')
        ]

        var longitudes = extent4326.map(e => { return e[0] })
        var latitudes = extent4326.map(e => { return e[1] })

        var bounds = {
          'latmin': Math.min(...latitudes).toFixed(6),
          'latmax': Math.max(...latitudes).toFixed(6),
          'lngmin': Math.min(...longitudes).toFixed(6),
          'lngmax': Math.max(...longitudes).toFixed(6)
        }

        var url = `http://${serverIp}/data?${querystring.stringify(bounds)}`
        console.log('Url: ' + url)

        return url
      },

      format: new ol.format.GPX()
    })

    var heatmap = new ol.layer.Heatmap({
      source: vectorSource,
      radius: 5,
      blur: 15
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
  }
}
</script>

<style scoped>
.map {
    height: 800px;
}
</style>
