import 'server-only'
import type { ChannelAdapter } from './_types'
import { cafe24Adapter } from './cafe24'
import { smartstoreAdapter } from './smartstore'
import { naverAdAdapter } from './naver-ad'

const adapters: Record<string, ChannelAdapter> = {
  cafe24: cafe24Adapter,
  smartstore: smartstoreAdapter,
  naver_ad: naverAdAdapter,
}

export function getAdapter(channel: string): ChannelAdapter | undefined {
  return adapters[channel]
}

export function listEnabledChannels(): string[] {
  return Object.keys(adapters)
}
