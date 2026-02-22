import { Playfair_Display, Noto_Sans_JP, Source_Sans_3, IBM_Plex_Mono } from 'next/font/google'
import './justtcg.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading-en',
  weight: ['600', '700'],
  display: 'swap',
})

const notoSans = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-body-ja',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body-en',
  weight: ['400', '500', '600'],
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono-price',
  weight: ['500', '600'],
  display: 'swap',
})

export default function JustTcgLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-page="justtcg"
      className={`${playfair.variable} ${notoSans.variable} ${sourceSans.variable} ${ibmPlexMono.variable}`}
    >
      {children}
    </div>
  )
}
