// job_type → adapter method name 매핑

const JOB_TYPE_TO_METHOD = {
  orders: 'syncOrders',
  products: 'syncProducts',
  ad_stats: 'syncAdStats',
  ad_units: 'syncAdUnits',
  token_refresh: 'refreshToken',
  analytics: 'syncAnalytics',
}

module.exports = { JOB_TYPE_TO_METHOD }
