
import Vue from 'vue'
import Vuex from 'vuex'

import axios from 'axios'
import {ORIGIN_SERVER} from '@/constants.js'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    athlete: null,
    activities: [],
    filters: {}
  },
  actions: {
    fetchAthlete ({ commit }, athleteId) {
      axios.get(`${ORIGIN_SERVER}/api/athletes/${athleteId}`)
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
    }
  }
})
