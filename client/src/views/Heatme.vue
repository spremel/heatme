<template>
  <b-container>
    <h2>Heat Me !</h2>
    <div id="map" class="map"></div>
    <form>
      <label>radius size</label>
      <input id="radius" type="range" min="1" max="50" step="1" value="5"/>
      <label>blur size</label>
      <input id="blur" type="range" min="1" max="50" step="1" value="15"/>
    </form>
    <div>
      <b-button v-on:click="loginStrava">Heat Me !</b-button>
    </div>
  </b-container>
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
