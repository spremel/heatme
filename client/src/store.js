
import Vue from 'vue'
import Vuex from 'vuex'

import axios from 'axios'
import {ORIGIN_SERVER} from '@/constants.js'

import * as proj from 'ol/proj'
import * as extent from 'ol/extent'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    athlete: null,
    activities: [],
    filters: {}
  },
  actions: {
    fetchAthlete ({ commit }, athleteId) {
      axios.get(`${ORIGIN_SERVER}/athletes/${athleteId}`)
        .then(res => {
          commit('setAthlete', res.data)
        })
        .catch(err => {
          console.error(`Failed to fetch athlete information for athlete ${athleteId}: ${err}`)
        })
    }
  },
  mutations: {
    setAthlete: (state, athlete) => {
      state.athlete = athlete
    },
    updateFilters: (state, filters) => {
      state.filters = {...state.filters, ...filters}
    }
  },
  getters: {
    athlete: (state) => {
      console.log(state.athlete)
      return state.athlete
    },
    filters: (state) => {
      return state.filters
    },
    queryFilters: (state) => {
      var filters = { }

      if (state.filters.extent) {
        var extent4326 = [
          proj.transform(extent.getBottomLeft(state.filters.extent), 'EPSG:3857', 'EPSG:4326'),
          proj.transform(extent.getTopLeft(state.filters.extent), 'EPSG:3857', 'EPSG:4326'),
          proj.transform(extent.getTopRight(state.filters.extent), 'EPSG:3857', 'EPSG:4326'),
          proj.transform(extent.getBottomRight(state.filters.extent), 'EPSG:3857', 'EPSG:4326')
        ]

        var longitudes = extent4326.map(e => { return e[0] })
        var latitudes = extent4326.map(e => { return e[1] })

        filters.latmin = Math.min(...latitudes).toFixed(6)
        filters.latmax = Math.max(...latitudes).toFixed(6)
        filters.lngmin = Math.min(...longitudes).toFixed(6)
        filters.lngmax = Math.max(...longitudes).toFixed(6)
      }

      if (state.filters.types && state.filters.types.length) {
        filters.types = state.filters.types.join(',')
      }

      if (state.filters.after) {
        filters.after = ~~(state.filters.after.getTime() / 1000)
      }

      if (state.filters.before) {
        filters.before = ~~(state.filters.before.getTime() / 1000)
      }

      return filters
    }
  }
})
