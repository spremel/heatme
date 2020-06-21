<template>
<div>
  <b-sidebar id="sidebar-settings" title="Settings" shadow>
    <b-form-group
      label="Map"
      label-align="right"
      label-size="lg"
      label-class="font-weight-bold pt-0"
      class="subsection"
      >
      <b-form-group
        label="Radius (px):"
        label-cols="4"
        label-align="right"
        >
        <b-form-input
          type="range"
          min="1"
          max="10"
          step="1"
          v-model="radiusValue"
          v-on:input="radiusHandler"
          v-on:change="radiusHandler"
          />
      </b-form-group>
      <b-form-group
        label="Blur (px):"
        label-cols="4"
        label-align="right"
        >
        <b-form-input
          type="range"
          min="1"
          max="20"
          step="1"
          v-model="blurValue"
          v-on:input="blurHandler"
          v-on:change="blurHandler"
          />
      </b-form-group>
      <b-form-group
        label="Style:"
        label-cols="4"
        label-align="right"
        >
        <b-form-select
          v-model="selectedMapSource"
          v-on:change="mapSourceHandler"
          :options="mapSources"
          />
      </b-form-group>
    </b-form-group>
    <b-form-group
      label="Activities"
      label-align="right"
      label-size="lg"
      label-class="font-weight-bold pt-0"
      class="subsection"
      >
      <b-form-group
        >
        <b-form-checkbox-group
          multiple
          v-model="selectedTypes"
          v-on:input="activityTypeHandler"
          :options="types"
          />
      </b-form-group>
      <b-form-group
        label="After:"
        label-cols="4"
        label-align="right"
        >
        <b-form-datepicker
          :reset-button="true"
          v-model="dateAfter"
          v-on:input="dateAfterHandler"
          />
      </b-form-group>
      <b-form-group
        label="Before:"
        label-cols="4"
        label-align="right"
        >
        <b-form-datepicker
          :reset-button="true"
          v-model="dateBefore"
          v-on:input="dateBeforeHandler"
          />
      </b-form-group>
  </b-form-group>
  </b-sidebar>
</div>
</template>

<script>

export default {
  name: 'MapSettings',
  data () {
    return {
      radiusValue: 1,
      blurValue: 1,

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

      selectedTypes: ['run', 'ride', 'swim'],
      types: [
        {value: 'run', text: 'Run'},
        {value: 'ride', text: 'Ride'},
        {value: 'swim', text: 'Swim'},
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
      console.log(this.selectedTypes)
      this.$root.$emit('filter-type-changed', this.selectedTypes)
    },
    mapSourceHandler () {
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

.subsection {
    margin-top: 20px;
    margin-bottom: 10px;
    padding-right: 10px;
    padding-left: 10px;
}

</style>
