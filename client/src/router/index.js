import Vue from 'vue'
import Router from 'vue-router'
import VueCookies from 'vue-cookies'

import Heatme from '@/views/Heatme'
import Map from '@/views/Map'

Vue.use(Router)
Vue.use(VueCookies)

export default new Router({
  routes: [
    {
      name: 'Root',
      path: '/',
      component: Heatme,
      redirect: to => {
        var athleteId = Vue.$cookies.get('athlete')
        if (athleteId) {
          return `/map/${athleteId}`
        }
        return '/welcome'
      }
    },
    {
      name: 'Welcome',
      path: '/welcome',
      component: Heatme
    },
    {
      name: 'Map',
      path: '/map/:athleteId',
      component: Map
    }
  ]
})
