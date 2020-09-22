<template>
<b-container fluid>
  <MapSettings></MapSettings>
  <div id="map">
  </div>
</b-container>
</template>

<script>
/* eslint-disable */

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
ol.control = require('ol/control')

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
  methods: {
    getFilters: function (activityTypes, dateBefore, dateAfter, extent) {
      var filters = this.$store.getters.queryFilters

      var extent4326 = [
        ol.proj.transform(ol.extent.getBottomLeft(extent), 'EPSG:3857', 'EPSG:4326'),
        ol.proj.transform(ol.extent.getTopLeft(extent), 'EPSG:3857', 'EPSG:4326'),
        ol.proj.transform(ol.extent.getTopRight(extent), 'EPSG:3857', 'EPSG:4326'),
        ol.proj.transform(ol.extent.getBottomRight(extent), 'EPSG:3857', 'EPSG:4326')
      ]
      
      var longitudes = extent4326.map(e => { return e[0] })
      var latitudes = extent4326.map(e => { return e[1] })

      filters.latmin = Math.min(...latitudes).toFixed(6)
      filters.latmax = Math.max(...latitudes).toFixed(6)
      filters.lngmin = Math.min(...longitudes).toFixed(6)
      filters.lngmax = Math.max(...longitudes).toFixed(6)

      filters.athletes = [this.athlete].join(',')
      filters.format = 'heatmap'
      
      return filters
    }
  },
  mounted () {
    var self = this

    var ToggleMapSettings = /*@__PURE__*/(function (Control) {
      function ToggleMapSettings(opt_options) {
        var options = opt_options || {}
        
        var button = document.createElement('button')
        button.innerHTML = 'S'
        
        var element = document.createElement('div')
        element.className = 'ol-settings ol-attribution ol-unselectable ol-control'
        element.appendChild(button)
        
        Control.call(this, {
          element: element,
          target: options.target
        })
        
        button.addEventListener('click', this.handleToggleMapSettings.bind(this), false)
      }
      
      if ( Control ) ToggleMapSettings.__proto__ = Control
      ToggleMapSettings.prototype = Object.create( Control && Control.prototype )
      ToggleMapSettings.prototype.constructor = ToggleMapSettings

      ToggleMapSettings.prototype.handleToggleMapSettings = function handleToggleMapSettings () {
        var sidebar = document.getElementById("sidebar-settings")
        if (sidebar.style['display'] == 'none') {
          sidebar.style.display = null
        } else {
          sidebar.style.display = 'none'
        }
      }
      return ToggleMapSettings
    }(ol.control.Control))

    var drawerSource = new ol.source.Vector()
    var drawer = new ol.layer.Vector({
      source: drawerSource
    })

    var vectorSource = new ol.source.Vector({
      strategy: ol.loadingstrategy.bbox,

      url: (extent, resolution, projection) => {
        var filters = self.$store.getters.filters
        var search = this.getFilters(filters.types, filters.before, filters.after, extent)
        search.format = 'heatmap'
        return `${ORIGIN_SERVER}/data?${querystring.stringify(search)}`
      },

      format: new customFormat.GPXWithId()
    })

    drawerSource.addEventListener('change', vectorSourceEvent => {
      var selectedExtent = ol.extent.createEmpty()
      drawerSource.forEachFeature(feat => {
        selectedExtent = ol.extent.extend(selectedExtent, feat.getGeometry().getExtent())
      })

      this.$store.commit('updateFilters', {'extent': selectedExtent})
    })

    var heatmap = new ol.layer.Heatmap({
      source: vectorSource
    })

    var raster = new ol.layer.Tile({
      source: new ol.source.OSM()
    })

    var map = new ol.Map({
      controls: ol.control.defaults().extend([new ToggleMapSettings()]),
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
    this.$root.$on('filters-changed', value => { vectorSource.refresh() })

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

#map {
    height: 100%;
    width: 100%;
    position:fixed;
    padding-right: 20px;
    padding-bottom: 10px;
}

</style>

<style>
@import url('ol/ol.css');

.ol-settings {
    bottom: 40px;
}

.ol-zoom {
    left: unset;
    right: 6px;
}
</style>
