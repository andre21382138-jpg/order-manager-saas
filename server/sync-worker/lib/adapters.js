// Plan 4 시점 stub registry — 실 sync 메서드는 Plan 5/6/7에서 추가
// 각 어댑터는 channel 식별자만 가지고 sync 메서드는 모두 없음 → worker가 skip

const cafe24Adapter = {
  channel: 'cafe24',
  // syncOrders/syncProducts/syncAdUnits/refreshToken — Plan 5에서 구현
}

const smartstoreAdapter = {
  channel: 'smartstore',
  // syncOrders/syncProducts — Plan 6에서 구현
}

const naverAdAdapter = {
  channel: 'naver_ad',
  // syncAdStats/syncAdUnits — Plan 7에서 구현
}

const adapters = {
  cafe24: cafe24Adapter,
  smartstore: smartstoreAdapter,
  naver_ad: naverAdAdapter,
}

function getAdapter(channel) {
  return adapters[channel]
}

module.exports = { getAdapter }
