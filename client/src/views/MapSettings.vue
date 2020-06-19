<template>
<div>
  <b-sidebar id="sidebar-settings" title="Settings" shadow>
    <b-container>
      <h4>Map</h4>
      <b-form-row class="mt-2">
        <label>Radius (px):</label>
        <b-form-input
          type="range"
          min="1"
          max="10"
          step="1"
          v-model="radiusValue"
          v-on:input="radiusHandler"
          v-on:change="radiusHandler"
          />
      </b-form-row>
      <b-form-row class="mt-2">
        <label>Blur (px):</label>
        <b-form-input
          type="range"
          min="1"
          max="20"
          step="1"
          v-model="blurValue"
          v-on:input="blurHandler"
          v-on:change="blurHandler"
          />
      </b-form-row>
      <b-form-row>
        <label>Map Style</label>
        <b-form-select
          v-model="selectedMapSource"
          v-on:change="mapSourceHandler"
          :options="mapSources"
          />
      </b-form-row>
    </b-container>
    <b-container>
      <h4>Activities</h4>
      <b-form-row class="mt-4">
        <label>Type:</label>
        <b-form-select
          multiple
          v-model="selectedTypes"
          v-on:change="activityTypeHandler"
          :options="types"
          />
      </b-form-row>
      <b-form-row class="mt-4">
        <label>After:</label>
        <b-form-datepicker
          :reset-button="true"
          v-model="dateAfter"
          v-on:input="dateAfterHandler"
          />
        <label>Before:</label>
        <b-form-datepicker
          :reset-button="true"
          v-model="dateBefore"
          v-on:input="dateBeforeHandler"
          />
      </b-form-row>
    </b-container>
  </b-sidebar>
</div>
</template>

<script>

export default {
  name: 'MapSettings',
  data () {
    return {
      radiusValue: 3,
      blurValue: 5,

      selectedMapSource: 'bing-road-dark',
      mapSources: [
        {value: 'osm', text: 'OpenStreetMap'},
        {value: 'bing-road-dark', text: 'Bing Road Dark'},
        {value: 'bing-road', text: 'Bing Road'},
        {value: 'stamen-toner', text: 'Toner'},
        {value: 'stamen-terrain', text: 'Terrain'}
      ],

      dateAfter: null,
      dateBefore: null,

      selectedTypes: ['run'],
      types: [
        {value: 'run', text: 'Run'},
        {value: 'ride', text: 'Ride'},
        {value: 'virtualrun', text: 'Virtual Run'},
        {value: 'virtualride', text: 'Virtual Ride'}
      ]
    }
  },
  methods: {
    blurHandler () {
      this.$root.$emit('heatmap-blur-changed', parseInt(this.blurValue, 10))
    },
    radiusHandler () {
      this.$root.$emit('heatmap-radius-changed', parseInt(this.radiusValue, 10))
    },
    activityTypeHandler () {
      this.$root.$emit('filter-type-changed', this.selectedTypes)
    },
    mapSourceHandler () {
      console.log('Map: ' + this.selectedMapSource)
      this.$root.$emit('map-source-changed', this.selectedMapSource)
    },
    dateAfterHandler () {
      this.$root.$emit('filter-date-after-changed', this.dateAfter ? new Date(this.dateAfter) : null)
    },
    dateBeforeHandler () {
      this.$root.$emit('filter-date-before-changed', this.dateBefore ? new Date(this.dateBefore) : null)
    }
  },
  mounted () {
    this.$root.$on('map-mounted', () => {
      this.blurHandler()
      this.radiusHandler()
      this.activityTypeHandler()
      this.mapSourceHandler()
    })
  }
}
</script>

<style scoped>
label {
    display: inline-block;
    margin-right: 20px;
    vertical-align: top;
}

h4 {
    margin-top: 40px;
    margin-bottom: 10px;
    text-align: right;
}

</style>
