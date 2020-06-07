import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import {Heatmap as HeatmapLayer, Vector as VectorLayer, Tile as TileLayer} from 'ol/layer';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import GPX from 'ol/format/GPX';

var blur = document.getElementById('blur');
var radius = document.getElementById('radius');

var serverIp = "35.210.237.237"
var vectorSource = new VectorSource({
  url: 'http://' + serverIp + '/data/test/constance.gpx',
  format: new GPX()
});

var heatmap = new HeatmapLayer({
  source: vectorSource,
  blur: parseInt(blur.value, 10),
  radius: parseInt(radius.value, 10)
});

var raster = new TileLayer({
  source: new ol.source.OSM()
});

new Map({
  layers: [raster, heatmap],
  target: 'map',
  view: new View({
    center: [0, 0],
    zoom: 2
  })
});

var blurHandler = function() {
  heatmap.setBlur(parseInt(blur.value, 10));
};

blur.addEventListener('input', blurHandler);
blur.addEventListener('change', blurHandler);

var radiusHandler = function() {
  heatmap.setRadius(parseInt(radius.value, 10));
};
radius.addEventListener('input', radiusHandler);
radius.addEventListener('change', radiusHandler);
