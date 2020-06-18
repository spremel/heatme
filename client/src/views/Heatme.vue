<template>
<div id="main-div">
  <b-img id="logo" src='static/heat-me.png' />
  <b-button id="btn" size="lg" v-on:click="loginStrava">Heat Me</b-button>
</div>
</template>

<script>

export default {

  name: 'Heatme',
  data () {
    return { }
  },
  methods: {
    loginStrava: () => {
      // var serverIp = '35.210.237.237'
      var serverIp = 'localhost:8080'

      location.href = `http://www.strava.com/oauth/authorize?client_id=49670&response_type=code&redirect_uri=http://${serverIp}/token_exchange&approval_prompt=force&scope=activity:read`
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
