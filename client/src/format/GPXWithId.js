import GPX from 'ol/format/GPX.js'

var __extends = (this && this.__extends) || (function () {
  var extendStatics = function (d, b) {
    extendStatics = Object.setPrototypeOf ||
      // ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b }) ||
      function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p] }
    return extendStatics(d, b)
  }
  return function (d, b) {
    extendStatics(d, b)
    function __ () { this.constructor = d }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __())
  }
})()

var GPXWithId = /** @class */ (function (_super) {
  __extends(GPXWithId, _super)
  /**
   * @param {Options=} opt_options Options.
   * @param {String=} id_field property field used to identify a feature.
   */
  function GPXWithId (optOptions, idField) {
    var _this = _super.call(this) || this
    _this.idField = idField || 'name'
    return _this
  }

  /**
   * @inheritDoc
   */
  GPXWithId.prototype.readFeatureFromNode = function (node, optOptions) {
    var f = GPX.prototype.readFeatureFromNode.call(this, node, optOptions)
    f.setId(f.getProperties()[this.idField])
    return f
  }
  /**
   * @inheritDoc
   */
  GPXWithId.prototype.readFeaturesFromNode = function (node, optOptions) {
    return GPX.prototype.readFeaturesFromNode.call(this, node, optOptions).map(f => {
      f.setId(f.getProperties()[this.idField])
      return f
    })
  }

  return GPXWithId
}(GPX))

export default GPXWithId
