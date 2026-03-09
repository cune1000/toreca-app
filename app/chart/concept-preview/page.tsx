'use client'

import { formatPrice, formatUsd } from '@/lib/chart/format'

const mockCard = {
    id: "mock1",
    name: "ピカチュウ (AR)",
    image_url: "https://placehold.co/300x420/f8fafc/94a3b8?text=Card+Img",
    display_price: 24800,
    display_price_usd: 165.5,
    price_change_30d: 15.2,
    rarity: "AR",
}

// Concept 1: Bento (Neo Minimalist)
function Concept1Bento() {
    return (
        <div className="w-[180px] bg-white rounded-none border-[3px] border-black p-3 flex flex-col gap-3 group relative hover:-translate-y-1 transition-transform">
            <div className="absolute top-0 right-0 bg-black text-white px-2 py-1 text-xs font-black">
                +15.2%
            </div>
            <div className="absolute -top-3 -left-3 w-8 h-8 bg-yellow-400 border-[3px] border-black flex items-center justify-center font-black text-xl z-10">
                1
            </div>

            <div className="w-full h-[180px] bg-gray-100 border-[3px] border-black flex items-center justify-center p-2">
                <img src={mockCard.image_url} alt="" className="h-full object-contain mix-blend-multiply" />
            </div>

            <div className="flex flex-col gap-1">
                <span className="text-[10px] bg-black text-white px-1.5 py-0.5 w-fit font-bold uppercase tracking-wider">{mockCard.rarity}</span>
                <p className="font-extrabold text-sm leading-tight text-black line-clamp-2">{mockCard.name}</p>
            </div>

            <div className="mt-auto border-t-[3px] border-black pt-2">
                <p className="text-xl font-black text-black tabular-nums tracking-tighter">
                    {formatPrice(mockCard.display_price)}
                </p>
            </div>
        </div>
    )
}

// Concept 2: Premium Dark & Neon
function Concept2DarkNeon() {
    return (
        <div className="w-[180px] bg-slate-900 rounded-2xl border border-white/10 p-3 flex flex-col gap-3 group relative hover:-translate-y-1 transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30 z-10 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                +15.2%
            </div>
            <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center font-black text-amber-950 z-10 shadow-[0_0_15px_rgba(251,191,36,0.6)]">
                1
            </div>

            <div className="w-full h-[180px] bg-slate-800/50 rounded-xl flex items-center justify-center p-2 relative overflow-hidden backdrop-blur-sm">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-purple-500/30 blur-2xl rounded-full" />
                <img src={mockCard.image_url} alt="" className="h-full object-contain relative z-10 group-hover:scale-110 transition-transform duration-500 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]" />
            </div>

            <div className="flex flex-col gap-1 relative z-10">
                <span className="text-[9px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded w-fit font-bold">{mockCard.rarity}</span>
                <p className="font-bold text-sm leading-tight text-white line-clamp-2">{mockCard.name}</p>
            </div>

            <div className="mt-auto pt-2 relative z-10">
                <p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400 tabular-nums">
                    {formatPrice(mockCard.display_price)}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold">{formatUsd(mockCard.display_price_usd)}</p>
            </div>
        </div>
    )
}

// Concept 3: Soft Neumorphism
function Concept3Neumorphism() {
    return (
        <div className="w-[180px] rounded-[1.5rem] p-4 flex flex-col gap-3 group transition-all"
            style={{
                backgroundColor: '#e0e5ec',
                boxShadow: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)'
            }}>

            <div className="relative flex justify-between items-center z-10">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-amber-600"
                    style={{ boxShadow: 'inset 3px 3px 6px #c8d0e7, inset -3px -3px 6px #ffffff' }}>
                    1
                </div>
                <div className="px-2 py-1 rounded-full text-[10px] font-black text-emerald-600"
                    style={{ boxShadow: 'inset 2px 2px 5px #c8d0e7, inset -2px -2px 5px #ffffff' }}>
                    +15.2%
                </div>
            </div>

            <div className="w-full h-[170px] rounded-2xl flex items-center justify-center p-3"
                style={{ boxShadow: 'inset 5px 5px 10px #c8d0e7, inset -5px -5px 10px #ffffff' }}>
                <img src={mockCard.image_url} alt="" className="h-full object-contain group-hover:scale-105 transition-transform duration-300 mix-blend-darken" />
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
                <span className="text-[9px] text-slate-500 font-bold px-2 py-0.5 rounded-full w-fit"
                    style={{ boxShadow: '2px 2px 5px #c8d0e7, -2px -2px 5px #ffffff' }}>
                    {mockCard.rarity}
                </span>
                <p className="font-bold text-sm leading-tight text-slate-700">{mockCard.name}</p>
            </div>

            <div className="mt-auto pt-2">
                <p className="text-xl font-black text-slate-800 tabular-nums">
                    {formatPrice(mockCard.display_price)}
                </p>
            </div>
        </div>
    )
}


export default function ConceptPreviewPage() {
    return (
        <div className="min-h-screen p-8 bg-gray-50 flex flex-col gap-12 font-sans">
            <div className="max-w-4xl mx-auto space-y-12">
                <h1 className="text-3xl font-black text-center mb-8">3つの新デザインコンセプト</h1>

                <section className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold mb-2">1. Neo-Minimalist &quot;Bento&quot;</h2>
                        <p className="text-sm text-gray-500 mb-4">極太の境界線、はっきりとしたコントラスト、整理されたグリッド。情報を最も読みやすく、ストリートカルチャーや最新のECサイトで流行しているスタイルです。</p>
                    </div>
                    <div className="flex justify-center flex-1">
                        <Concept1Bento />
                    </div>
                </section>

                <section className="bg-slate-950 p-8 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row items-center gap-8 text-white">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold mb-2">2. Premium Dark & Neon</h2>
                        <p className="text-sm text-slate-400 mb-4">深いダーク背景に、属性色に合わせた淡いネオングロー。高額なコレクターズアイテムの高級感や特別感を最大限に引き出す、所有欲を満たすスタイルです。</p>
                    </div>
                    <div className="flex justify-center flex-1">
                        <Concept2DarkNeon />
                    </div>
                </section>

                <section className="p-8 rounded-3xl flex flex-col md:flex-row items-center gap-8" style={{ backgroundColor: '#e0e5ec' }}>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold mb-2 text-slate-800">3. Soft Neumorphism</h2>
                        <p className="text-sm text-slate-600 mb-4">光と影だけで凹凸を表現するスタイル。立体的で物理的なメダルやボタンに触れているような、未来的かつ親しみやすいユニークなUIです。</p>
                    </div>
                    <div className="flex justify-center flex-1">
                        <Concept3Neumorphism />
                    </div>
                </section>
            </div>
        </div>
    )
}
