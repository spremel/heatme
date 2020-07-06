
import Vue from 'vue'
import Vuex from 'vuex'

import axios from 'axios'
import {ORIGIN_SERVER} from '@/constants.js'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    athlete: null
  },
  mutations: {
    fetchAthlete: (state, athleteId) => {
      axios.get(`${ORIGIN_SERVER}/athletes/${athleteId}`)
        .then(res => {
          state.athlete = res.data
        })
        .catch(err => {
          console.error(`Failed to fetch athlete information for athlete ${athleteId}: ${err}`)
        })
    }
  },
  getters: {
    athlete: (state) => {
      return state.athlete
    }
  }
})
