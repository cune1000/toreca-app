'use client'

import React, { useState } from 'react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const [pageJumpInput, setPageJumpInput] = useState('')

  if (totalPages <= 1) return null

  const handleJump = () => {
    const p = parseInt(pageJumpInput)
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p)
      setPageJumpInput('')
    }
  }

  return (
    <div className="px-4 py-3 border-t flex flex-wrap items-center justify-center gap-1.5">
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-30"
      >
        最初
      </button>
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-2.5 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-30"
      >
        ←
      </button>
      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        let page = i + 1
        if (totalPages > 5) {
          if (currentPage > 3) page = currentPage - 2 + i
          if (currentPage > totalPages - 2) page = totalPages - 4 + i
        }
        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-2.5 py-1 rounded text-xs ${currentPage === page ? 'bg-blue-500 text-white' : 'border hover:bg-gray-50'}`}
          >
            {page}
          </button>
        )
      })}
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="px-2.5 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-30"
      >
        →
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-30"
      >
        最後
      </button>
      <span className="text-[10px] text-gray-400 mx-1">|</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={totalPages}
          value={pageJumpInput}
          onChange={e => setPageJumpInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleJump()
          }}
          placeholder={`${currentPage}/${totalPages}`}
          className="w-16 px-1.5 py-1 border rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={handleJump}
          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
        >
          Go
        </button>
      </div>
    </div>
  )
}
