'use client'

import { AffiliateLink } from '@/lib/chart/affiliate'

interface Props {
    links: AffiliateLink[]
}

export default function AffiliateButtons({ links }: Props) {
    return (
        <div className="space-y-2">
            {links.map((link) => (
                <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full ${link.color} text-white rounded-xl px-4 py-3 flex items-center gap-3
            transition-all active:scale-[0.98] hover:shadow-md block`}
                >
                    <span className="text-lg">{link.icon}</span>
                    <div className="text-left">
                        <p className="text-sm font-bold">{link.name}</p>
                        {link.sub && (
                            <p className="text-[10px] opacity-80">{link.sub}</p>
                        )}
                    </div>
                    <span className="ml-auto text-white/60">→</span>
                </a>
            ))}
        </div>
    )
}
