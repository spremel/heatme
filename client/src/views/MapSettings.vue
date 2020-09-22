<template>
<div>
  <b-sidebar id="sidebar-settings" title="Settings" no-header shadow>
    <b-form-group
      label="Map"
      label-align="right"
      label-size="lg"
      label-class="font-weight-bold pt-0"
      class="subsection"
      >
      <b-form-group
        label="Radius:"
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
        label="Blur:"
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
      <b-form-checkbox-group
        multiple
        v-model="selectedTypes"
        v-on:input="activityTypeHandler"
        :options="types"
        />
      <b-form-group
        label="After"
        label-cols="4"
        label-align="right"
        class="mt-4"
        >
        <b-form-datepicker
          size="sm"
          :reset-button="true"
          v-model="dateAfter"
          v-on:input="dateAfterHandler"
          />
      </b-form-group>
      <b-form-group
        label="Before"
        label-cols="4"
        label-align="right"
        class="mt-4"
        >
        <b-form-datepicker
          size="sm"
          :reset-button="true"
          v-model="dateBefore"
          v-on:input="dateBeforeHandler"
          />
      </b-form-group>
    </b-form-group>
    <template v-slot:footer="{ hide }">
      <b-form-group
        label="Session"
        label-align="right"
        label-size="lg"
        label-class="font-weight-bold pt-0"
        class="subsection"
        >
        <b-button-group id="session">
          <b-button
            id="logout"
            size="sm"
            variant="outline-dark"
            v-on:click="logoutHandler"
            class="mr-1"
            >
            <b-icon
              icon="power" aria-hidden="true">
            </b-icon>
            Logout
          </b-button>
          <b-button
            id="erase-data"
            size="sm"
            variant="outline-dark"
            v-b-modal.erase-data-confirm
            >
            <b-icon icon="trash" aria-hidden="true"></b-icon>
            Erase all
          </b-button>
          <!-- The modal -->
          <b-modal
            id="erase-data-confirm"
            @ok="eraseDataHandler"
            >
            Erase all my data from the application ?
        </b-modal>
      </b-button-group>
    </b-form-group>
    </template>
  </b-sidebar>
</div>
</template>

<script>
import {ORIGIN_SERVER} from '@/constants.js'
import axios from 'axios'

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
      ],

      athlete: this.$route.params.athleteId,
      selectAreas: false
    }
  },
  methods: {
    blurHandler () {
      this.$root.$emit('heatmap-blur-changed', parseInt(this.blurValue, 10))
    },
    radiusHandler () {
      this.$root.$emit('heatmap-radius-changed', parseInt(this.radiusValue, 10))
    },
    mapSourceHandler () {
      this.$root.$emit('map-source-changed', this.selectedMapSource)
    },

    selectAreasHandler () {
      this.$root.$emit('select-areas-toggled', this.selectAreas)
    },
    resetAreasHandler () {
      this.$root.$emit('reset-areas-clicked')
    },

    activityTypeHandler () {
      this.$store.commit('updateFilters', {'types': this.selectedTypes})
      this.$root.$emit('filters-changed')
    },
    dateAfterHandler () {
      var d = this.dateAfter ? new Date(this.dateAfter) : null
      this.$store.commit('updateFilters', {'after': d})
      this.$root.$emit('filters-changed')
    },
    dateBeforeHandler () {
      var d = this.dateBefore ? new Date(this.dateBefore) : null
      this.$store.commit('updateFilters', {'before': d})
      this.$root.$emit('filters-changed')
    },

    logoutHandler () {
      axios.post(`${ORIGIN_SERVER}/athletes/${this.athlete}/logout`)
        .then(res => {
          this.$cookies.remove('athlete')
          this.$router.push({name: 'Welcome'})
        })
        .catch(err => {
          console.error(`Failed to logout: ${err}`)
        })
    },
    eraseDataHandler () {
      axios.delete(`${ORIGIN_SERVER}/athletes/${this.athlete}`)
        .then(res => {
          this.$cookies.remove('athlete')
          this.$router.push({name: 'Welcome'})
        })
        .catch(err => {
          console.error(`Failed to erase: ${err}`)
        })
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
