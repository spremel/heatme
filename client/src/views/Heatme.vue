<template>
<div id="main-div">
  <b-img id="logo" src='static/heat-me.png' />
  <b-button id="btn" size="lg" v-on:click="loginStrava">Heat Me</b-button>
</div>
</template>

<script>

import {ORIGIN_SERVER, AUTH_SERVER, CLIENT_ID} from '@/constants.js'
export default {

  name: 'Heatme',
  data () {
    return { }
  },
  methods: {
    loginStrava: () => {
      location.href = `${AUTH_SERVER}/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${ORIGIN_SERVER}/token_exchange&approval_prompt=force&scope=activity:read`
    }
  },
  mounted () {
    let olScript = document.createElement('script')
    olScript.setAttribute('src', 'https://cdn.jsdelivr.net/gh/openlayers/openlayers.github.io@master/en/v6.3.1/build/ol.js')
    document.head.appendChild(olScript)
  }
}
</script>

<style scoped>
  #main-div {
    background-color: rgb(0,0,0);
    width: 100%;
    height: 100%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%)
  }
  #btn {
    position: absolute;
    top: 85%;
    left: 50%;
    transform: translate(-50%, -50%)
  }
  #logo {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%)
  }
</style>
