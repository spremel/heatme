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
ol.style = require('ol/style')

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
    formatFilters: function (athlete, activityTypes, dateBefore, dateAfter, extent, format) {
      var filters = { }
      
      if (athlete) {
        filters.athletes = [athlete].join(',')
      }
      
      if (activityTypes && activityTypes.length) {
        filters.types = activityTypes.join(',')
      }
      
      if (dateAfter) {
        filters.after = ~~(dateAfter.getTime() / 1000)
      }
      
      if (dateBefore) {
        filters.before = ~~(dateBefore.getTime() / 1000)
      }
      
      if (extent) {
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
      }
      
      filters.format = format
      
      return filters
    },
    urlCallback: function(format) {
      var self = this
      var callback = function(extent, resolution, projection) {
        var f = self.$store.getters.filters
        var search = self.formatFilters(self.athlete, f.types, f.before, f.after, extent, format)
        return `${ORIGIN_SERVER}/api/data?${querystring.stringify(search)}`
      }
      return callback
    }
  },
  mounted () {
    
    var self = this
    
    var drawerSource = new ol.source.Vector()
    var drawer = new ol.layer.Vector({
      source: drawerSource
    })
    
    var vectorSource = new ol.source.Vector({
      strategy: ol.loadingstrategy.bbox,
      url: this.urlCallback(),
      format: new customFormat.GPXWithId()
    })
    
    drawerSource.addEventListener('change', vectorSourceEvent => {
      var selectedExtent = ol.extent.createEmpty()
      drawerSource.forEachFeature(feat => {
        selectedExtent = ol.extent.extend(selectedExtent, feat.getGeometry().getExtent())
      })
      
      this.$store.commit('updateFilters', {'extent': selectedExtent})
    })
    
    var routes = new ol.layer.Vector({
      source: vectorSource,
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: '#f00',
          width: 3
        })
      })
    })

    var heatmap = new ol.layer.Heatmap({
      source: vectorSource
    })
    
    var raster = new ol.layer.Tile({
      source: new ol.source.OSM()
    })
    
    var CustomToolbar = /*@__PURE__*/(function (Control) {
      function CustomToolbar(opt_options) {
        var options = opt_options || {}
        
        var element = document.createElement('div')
        element.className = 'ol-zoom ol-unselectable ol-control ol-dock'
        
        var buttonSettings = document.createElement('button')
        buttonSettings.style['background-image'] = 'url(static/gear-fill.svg)'
        buttonSettings.style['background-size'] = 'contain'
        buttonSettings.style['background-repeat'] = 'no-repeat'
        
        var divSettings = document.createElement('div')
        divSettings.className = 'ol-selection'
        element.appendChild(buttonSettings)
        
        var buttonSelection = document.createElement('button')
        buttonSelection.id = 'ol-button-selection'
        buttonSelection.style['background-image'] = 'url(static/bounding-box-circles.svg)'
        buttonSelection.style['background-size'] = 'contain'
        buttonSelection.style['background-repeat'] = 'no-repeat'
        
        var buttonClearSelection = document.createElement('button')
        buttonClearSelection.style['background-image'] = 'url(static/x-circle.svg)'
        buttonClearSelection.style['background-size'] = 'contain'
        buttonClearSelection.style['background-repeat'] = 'no-repeat'
        
        var divSelection = document.createElement('div')
        divSelection.className = 'ol-selection'
        divSelection.appendChild(buttonSelection)
        divSelection.appendChild(buttonClearSelection)
        
        var buttonListActivities = document.createElement('button')
        buttonListActivities.style['background-image'] = 'url(static/list.svg)'
        buttonListActivities.style['background-size'] = 'contain'
        buttonListActivities.style['background-repeat'] = 'no-repeat'
        
        var divActivities = document.createElement('div')
        divActivities.className = 'ol-activities'
        divActivities.appendChild(buttonListActivities)
        
        element.appendChild(divSettings)
        element.appendChild(divSelection)
        element.appendChild(divActivities)
        
        Control.call(this, {
          element: element,
          target: options.target
        })
        
        buttonSettings.addEventListener('click', this.handleToggleMapSettings.bind(this), false)
        buttonSelection.addEventListener('click', this.handleToggleSelection.bind(this), false)
        buttonClearSelection.addEventListener('click', this.handleClearSelection.bind(this), false)
        buttonListActivities.addEventListener('click', this.handleListActivities.bind(this), false)
      }
      
      if ( Control ) CustomToolbar.__proto__ = Control
      CustomToolbar.prototype = Object.create( Control && Control.prototype )
      CustomToolbar.prototype.constructor = CustomToolbar
      
      CustomToolbar.prototype.handleToggleMapSettings = function handleToggleMapSettings () {
        var sidebar = document.getElementById("sidebar-settings")
        if (sidebar.style['display'] == 'none') {
          sidebar.style.display = null
        } else {
          sidebar.style.display = 'none'
        }
      }
      
      var draw = new ol.interaction.Draw({
        source: drawerSource,
        type: 'Circle'
      })
      draw.addEventListener('drawstart', drawEvent => {
        drawerSource.clear()
      })
      
      CustomToolbar.prototype.hasDrawInteraction = false
      CustomToolbar.prototype.handleToggleSelection = function handleToggleSelection () {
        var map = this.getMap()
        var button = document.getElementById('ol-button-selection')
        if (this.hasDrawInteraction) {
          button.style['background-image'] = 'url(static/bounding-box-circles.svg)'
          this.hasDrawInteraction = false
          map.removeInteraction(draw)
        } else {
          button.style['background-image'] = 'url(static/hand-index.svg)'
          this.hasDrawInteraction = true
          map.addInteraction(draw)
        }
      }
      
      CustomToolbar.prototype.handleClearSelection = function handleClearSelection () {
        drawerSource.clear()
      }
      
      CustomToolbar.prototype.handleListActivities = function handleListActivities () {
        var f = self.$store.getters.filters
        var s = self.formatFilters(self.athlete, f.types, f.before, f.after, f.extent, 'raw')
        var route = self.$router.resolve({name: 'Activities', params: {search: querystring.stringify(s)}})
        window.open(route.href, '_blank')
      }

      return CustomToolbar
    }(ol.control.Control))

    var map = new ol.Map({
      controls: ol.control.defaults().extend([new CustomToolbar()]),
      layers: [raster, heatmap, routes, drawer],
      target: 'map',
      view: new ol.View({
        center: [239655, 6242334],
        zoom: 8
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


    this.$root.$on('filters-changed', value => { vectorSource.refresh() })

    this.$root.$on('heatmap-blur-changed', value => { heatmap.setBlur(value) })
    this.$root.$on('heatmap-radius-changed', value => { heatmap.setRadius(value) })

    this.$root.$on('layer-changed', layer => {
      var format = 'gpx-waypoints'

      if (layer == 'heatmap') {
        format = 'gpx-waypoints'
        heatmap.setVisible(true)
        routes.setVisible(false)
      } else if (layer == 'routes') {
        format = 'gpx-tracks'
        heatmap.setVisible(false)
        routes.setVisible(true)
      }

      vectorSource.setUrl(this.urlCallback(format))
      vectorSource.refresh()
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

.ol-dock {
    top: 80px;
}

.ol-settings {
    padding-top: 10px;
}

.ol-selection {
    padding-top: 10px;
}

.ol-activities {
    padding-top: 20px;
}

.ol-zoom {
    left: unset;
    right: 6px;
}
</style>
