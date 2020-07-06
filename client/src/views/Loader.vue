<template>
<div id="loader-main-div">
  <b-img id="loader-logo" src="static/heat-me.png" fluid center/>
  <b-progress id="loader-progress" height="2rem" >
    <b-progress-bar id="loader-progress-bar" :value="progress">
      {{ loadingLabel }}
    </b-progress-bar>
  </b-progress>
</div>
</template>

<script>

export default {
  name: 'Loader',
  data () {
    return {
      progress: 0,
      rotation: 0
    }
  },
  methods: { },
  computed: {
    athlete: function () {
      return this.$store.getters.athlete
    },
    ready: function () {
      if (this.athlete) {
        return this.athlete.updatedAt
      }
      return false
    },
    loadingLabel: function () {
      if (this.athlete && this.athlete.loadedActivities) {
        return `${this.athlete.loadedActivities} activities loaded`
      }
      return 'Loading...'
    }
  },
  mounted () {
    this.animation = setInterval(() => {
      var img = document.getElementById('loader-logo')
      img.style.transform = `rotate(${this.rotation}deg)`
      this.rotation += 1
    }, 50)

    this.loader = setInterval(() => {
      this.$store.commit('fetchAthlete', this.$route.params.athleteId)
      if (this.athlete && this.athlete.lastActivityAt && this.athlete.firstActivityAt) {
        this.progress = 100 * (this.athlete.lastActivityAt - this.athlete.firstActivityAt) / (new Date() / 1000 - this.athlete.firstActivityAt)
      }

      if (this.ready) {
        clearInterval(this.loader)
        clearInterval(this.animation)
        // this.$router.push({name: 'Map', params: {id: this.athlete.athlete.id}})
      }
    }, 1000)
  },

  destroy () {
    clearInterval(this.loader)
    clearInterval(this.animation)
  }
}
</script>

<style scoped>
#loader-main-div {
    position: absolute;
    height: 100%;
    width: 100%;
    background:black;
}

#loader-logo {
    margin-top: 10%;
}

#loader-progress {
    position: absolute;
    width: 100%;
    bottom: 5%;
}

#loader-progress-bar {
    background: linear-gradient(to right, #589C0C 0%, #CDB026 45%, #E13E34 100%);
}
</style>
