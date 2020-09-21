<template>
<b-container fluid>
  <MapSettings></MapSettings>
  <div id="map">
    <b-button-group id="buttons-settings">
      <b-button
        v-b-toggle.sidebar-settings
        size="sm"
        v-b-tooltip.hover
        title="Settings"
        >
        <b-icon icon="gear-fill" aria-hidden="true"></b-icon>
      </b-button>
      <b-button
        v-bind:to="toActivities"
        :replace="true"
        target="_blank"
        size="sm"
        v-b-tooltip.hover
        title="View selected activities"
        >
        <b-icon icon="card-list" aria-hidden="true"></b-icon>
      </b-button>
    </b-button-group>
  </div>
</b-container>
</template>

<script>

import {ORIGIN_SERVER} from '@/constants.js'
import MapSettings from '@/views/MapSettings'
import Activities from '@/views/Activities'

const customFormat = require('@/format/format.js')

var ol = require('ol')
ol.source = require('ol/source')
ol.format = require('ol/format')
ol.layer = require('ol/layer')
ol.proj = require('ol/proj')
ol.extent = require('ol/extent')
ol.loadingstrategy = require('ol/loadingstrategy')
ol.coordinate = require('ol/coordinate')
ol.interaction = require('ol/interaction')

const querystring = require('querystring')

export default {
  name: 'Map',
  components: { MapSettings, Activities },
  data () {
    return {
      athlete: this.$route.params.athleteId,
      loading: true,
      filters: { }
    }
  },
  computed: {
    toActivities: function () {
      var f = this.filters
      f.format = 'raw'
      return `/activities/${querystring.stringify(f)}`
    }
  },
  methods: {
    getFilters: function (activityTypes, dateBefore, dateAfter, extent) {
      var extent4326 = [
        ol.proj.transform(ol.extent.getBottomLeft(extent), 'EPSG:3857', 'EPSG:4326'),
        ol.proj.transform(ol.extent.getTopLeft(extent), 'EPSG:3857', 'EPSG:4326'),
        ol.proj.transform(ol.extent.getTopRight(extent), 'EPSG:3857', 'EPSG:4326'),
        ol.proj.transform(ol.extent.getBottomRight(extent), 'EPSG:3857', 'EPSG:4326')
      ]

      var longitudes = extent4326.map(e => { return e[0] })
      var latitudes = extent4326.map(e => { return e[1] })

      var filters = {
        'athletes': [this.athlete].join(',')
      }

      if (activityTypes.length) {
        filters.types = activityTypes.join(',')
      }

      if (dateAfter) {
        filters.after = ~~(dateAfter.getTime() / 1000)
      }

      if (dateBefore) {
        filters.before = ~~(dateBefore.getTime() / 1000)
      }

      filters.format = 'heatmap'

      filters.latmin = Math.min(...latitudes).toFixed(6)
      filters.latmax = Math.max(...latitudes).toFixed(6)
      filters.lngmin = Math.min(...longitudes).toFixed(6)
      filters.lngmax = Math.max(...longitudes).toFixed(6)

      return filters
    }
  },
  mounted () {
    var self = this
    var activityTypes = []
    var dateAfter = null
    var dateBefore = null

    var drawerSource = new ol.source.Vector()
    var drawer = new ol.layer.Vector({
      source: drawerSource
    })

    var vectorSource = new ol.source.Vector({
      strategy: ol.loadingstrategy.bbox,

      url: (extent, resolution, projection) => {
        var filters = this.getFilters(activityTypes, dateBefore, dateAfter, extent)
        filters.format = 'heatmap'
        return `${ORIGIN_SERVER}/data?${querystring.stringify(filters)}`
      },

      format: new customFormat.GPXWithId()
    })

    drawerSource.addEventListener('change', vectorSourceEvent => {
      var selectedExtent = ol.extent.createEmpty()
      drawerSource.forEachFeature(feat => {
        selectedExtent = ol.extent.extend(selectedExtent, feat.getGeometry().getExtent())
      })

      self.filters = this.getFilters(activityTypes, dateBefore, dateAfter, selectedExtent)
    })

    var heatmap = new ol.layer.Heatmap({
      source: vectorSource
    })

    var raster = new ol.layer.Tile({
      source: new ol.source.OSM()
    })

    var map = new ol.Map({
      layers: [raster, heatmap, drawer],
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

    var draw = new ol.interaction.Draw({
      source: drawerSource,
      type: 'Circle'
    })
    draw.addEventListener('drawstart', drawEvent => {
      drawerSource.clear()
    })

    this.$root.$on('select-areas-toggled', value => {
      if (value) {
        map.addInteraction(draw)
      } else {
        map.removeInteraction(draw)
      }
    })
    this.$root.$on('reset-areas-clicked', () => {
      drawerSource.clear()
    })

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

#buttons-settings {
    position: absolute;
    top: 95%;
    left: 0%;
    z-index: 1;
    transform: translate(0%, -10%);
    margin-left: 10px;
}

</style>

<style>
@import url('ol/ol.css');

.ol-zoom {
    left: unset;
    right: 6px;
}
</style>
