'use client'

import React from 'react'
import { Globe } from 'lucide-react'
import type { SaleSite } from '@/lib/types'

// =============================================================================
// Types
// =============================================================================

interface Props {
  sites: SaleSite[]
}

// =============================================================================
// Component
// =============================================================================

export default function SitesPage({ sites }: Props) {
  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">販売サイト一覧</h2>
        </div>
        
        {sites.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {sites.map((site) => (
              <div key={site.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {site.icon ? (
                    <span className="text-2xl">{site.icon}</span>
                  ) : (
                    <Globe size={24} className="text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{site.name}</p>
                    {site.url && (
                      <a 
                        href={site.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:underline"
                      >
                        {site.url}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Globe size={48} className="mx-auto mb-4 text-gray-300" />
            <p>まだ販売サイトが登録されていません</p>
          </div>
        )}
      </div>
    </div>
  )
}
