'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X, MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMapStore, type SearchPlace } from '@/stores/mapStore'

export function SearchBar() {
  const setSearchPlace = useMapStore((s) => s.setSearchPlace)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchPlace[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced geocode against the Atlanta-bounded API. All state updates run
  // inside the async timeout callback so none fire synchronously during the
  // effect (which would trigger cascading renders).
  useEffect(() => {
    const q = query.trim()
    const controller = new AbortController()

    const t = setTimeout(async () => {
      if (q.length < 2) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as { results: SearchPlace[] }
        setResults(data.results ?? [])
        setOpen(true)
        setActiveIdx(-1)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([])
      } finally {
        setLoading(false)
      }
    }, q.length < 2 ? 0 : 300)

    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [query])

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function choose(place: SearchPlace) {
    setSearchPlace(place)
    setQuery(place.name)
    setOpen(false)
    setActiveIdx(-1)
  }

  function clear() {
    setQuery('')
    setResults([])
    setOpen(false)
    setSearchPlace(null)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[activeIdx >= 0 ? activeIdx : 0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="w-[22rem] max-w-[calc(100vw-2rem)]">
      <div className="relative flex items-center rounded-full border border-greentop-border bg-greentop-surface/90 shadow-lg backdrop-blur-md">
        <Search className="ml-4 h-4 w-4 shrink-0 text-greentop-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search places in Atlanta"
          className="w-full bg-transparent px-3 py-3 text-sm text-greentop-text placeholder:text-greentop-muted focus:outline-none"
        />
        {loading && <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-greentop-muted" />}
        {query && !loading && (
          <button
            onClick={clear}
            aria-label="Clear search"
            className="mr-3 rounded-full p-1 text-greentop-muted hover:bg-greentop-bg/60 hover:text-greentop-text"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-greentop-border bg-greentop-surface/95 shadow-xl backdrop-blur-md">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-greentop-muted">
              {loading ? 'Searching…' : 'No places found in Atlanta'}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => choose(r)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors',
                      i === activeIdx ? 'bg-greentop-green/10' : 'hover:bg-greentop-bg/60',
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-greentop-green" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-greentop-text">
                        {r.name}
                      </span>
                      <span className="block truncate text-xs text-greentop-muted">
                        {r.address}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
