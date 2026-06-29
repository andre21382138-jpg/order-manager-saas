import 'server-only'
import type { ChannelAdapter } from './_types'
import { cafe24Adapter } from './cafe24'

const adapters: Record<string, ChannelAdapter> = {
  cafe24: cafe24Adapter,
  // Plan 3에서 smartstore, naver_ad 추가
}

export function getAdapter(channel: string): ChannelAdapter | undefined {
  return adapters[channel]
}

export function listEnabledChannels(): string[] {
  return Object.keys(adapters)
}
