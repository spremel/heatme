<template>
<b-container>
  <h3>Settings</h3>
  <b-form-row>
    <label>Radius</label>
    <b-input
      type="range"
      min="1"
      max="50"
      step="1"
      v-bind:value="radiusValue"
      v-on:input="radiusHandler"
      v-on:change="radiusHandler"
      />
  </b-form-row>
  <b-form-row>
    <label>Blur</label>
    <b-input
      type="range"
      min="1"
      max="50"
      step="1"
      v-bind:value="blurValue"
      v-on:input="blurHandler"
      v-on:change="blurHandler"
      />
  </b-form-row>
</b-container>
</template>

<script>
export default {
  name: 'MapSettings',
  data () {
    return {
      radiusValue: 5,
      blurValue: 25
    }
  },
  methods: {
    blurHandler () {
      this.$root.$emit('heatmap-blur-changed', parseInt(this.blurValue, 10))
    },
    radiusHandler () {
      this.$root.$emit('heatmap-radius-changed', parseInt(this.radiusValue, 10))
    }
  }
}
</script>

<style scoped>
</style>
