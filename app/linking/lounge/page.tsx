'use client'

import { SOURCE_CONFIGS } from '../lib/constants'
import LinkingPage from '../components/LinkingPage'

export default function LoungeLinkingPage() {
  return <LinkingPage config={SOURCE_CONFIGS.lounge} />
}
