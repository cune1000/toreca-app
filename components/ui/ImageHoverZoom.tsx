'use client'

import React from 'react'

interface ImageHoverZoomProps {
  hoveredImage: { url: string; x: number; y: number } | null
}

export default function ImageHoverZoom({ hoveredImage }: ImageHoverZoomProps) {
  if (!hoveredImage) return null

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: Math.min(hoveredImage.x, window.innerWidth - 320),
        top: Math.max(8, Math.min(hoveredImage.y, window.innerHeight - 440)),
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-2">
        <img
          src={hoveredImage.url}
          alt=""
          className="w-72 h-auto max-h-[420px] object-contain rounded-lg"
        />
      </div>
    </div>
  )
}
