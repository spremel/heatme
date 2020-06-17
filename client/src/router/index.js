import Vue from 'vue'
import Router from 'vue-router'
// import HelloWorld from '@/components/HelloWorld'
import Heatme from '@/views/Heatme'
import Map from '@/views/Map'
Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'Heatme',
      component: Heatme
    },
    {
      path: '/map/:athleteId',
      name: 'Map',
      component: Map
    }
  ]
})
