import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import {Heatmap as HeatmapLayer, Vector as VectorLayer, Tile as TileLayer} from 'ol/layer';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import GPX from 'ol/format/GPX';

var blur = document.getElementById('blur');
var radius = document.getElementById('radius');

var source = new VectorSource({
  url: 'http://localhost/data/test/constance.gpx',
  format: new GPX()
});


var heatmapLayer = new HeatmapLayer({
  source: source,
  blur: parseInt(blur.value, 10),
  radius: parseInt(radius.value, 10),
  // weight: function(feature) {
  //   return 10;
  // }
});

var tileSource = new ol.source.OSM()
var raster = new TileLayer({
  source: tileSource
});

new Map({
  layers: [raster, heatmapLayer],
  target: 'map',
  view: new View({
    center: [0, 0],
    zoom: 2
  })
});

var blurHandler = function() {
  heatmapLayer.setBlur(parseInt(blur.value, 10));
};

blur.addEventListener('input', blurHandler);
blur.addEventListener('change', blurHandler);

var radiusHandler = function() {
  heatmapLayer.setRadius(parseInt(radius.value, 10));
};
radius.addEventListener('input', radiusHandler);
radius.addEventListener('change', radiusHandler);
