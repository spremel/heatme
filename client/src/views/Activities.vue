<template>
<div>
  <b-table
    striped
    hover
    small
    fixed
    primary-key="id"
    :items="items"
    :fields="fields"
    responsive="sm"
    >
    <template v-slot:cell(name)="data">
      <a :href="`${stravaServer}/activities/${data.item.id}`"> {{ data.value }}</a>
    </template>
  </b-table>
</div>
</template>

<script>
import constants from '@/constants.js'
import axios from 'axios'

export default {
  name: 'Activities',
  data () {
    return {
      stravaServer: constants.STRAVA_SERVER,
      fields: [
        {key: 'name'},
        {key: 'type'},
        {
          key: 'distance',
          formatter: (value, key, item) => {
            return `${(value / 1000).toFixed(2)} km`
          }
        },
        {
          key: 'start_date_local',
          label: 'Date',
          formatter: (value, key, item) => {
            return value.replace('T', ' at ').replace('Z', '')
          }
        }
      ],
      items: []
    }
  },
  beforeRouteEnter (to, from, next) {
    axios.get(`${constants.ORIGIN_SERVER}/data?${to.params.search}`)
      .then(res => {
        next(vm => { vm.items = res.data })
      })
      .catch(err => {
        console.log(`Failed to fetch activities: ${err}`)
      })
  }
}

</script>
