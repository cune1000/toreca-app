'use client'

import { SOURCE_CONFIGS } from '../lib/constants'
import LinkingPage from '../components/LinkingPage'

export default function ShinsokuLinkingPage() {
  return <LinkingPage config={SOURCE_CONFIGS.shinsoku} />
}
