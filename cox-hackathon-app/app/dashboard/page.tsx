'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Leaf,
  LogOut,
  MapPin,
  Trash2,
  ExternalLink,
  Plus,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardStore, type SavedPlan } from '@/stores/dashboardStore'

// ── formatting helpers ──────────────────────────────────────────────────────
const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Math.round(n).toLocaleString()}`

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function categoryColor(category: string): string {
  const c = category.toLowerCase()
  if (c.includes('solar')) return 'bg-greentop-amber/15 text-greentop-amber'
  if (c.includes('green')) return 'bg-greentop-green/15 text-greentop-green'
  if (c.includes('cool')) return 'bg-blue-500/15 text-blue-400'
  if (c.includes('rain')) return 'bg-sky-500/15 text-sky-400'
  if (c.includes('bee')) return 'bg-yellow-500/15 text-yellow-400'
  return 'bg-greentop-border/50 text-greentop-muted'
}

// ── Editable plan name ──────────────────────────────────────────────────────
function EditableName({ plan }: { plan: SavedPlan }) {
  const renamePlan = useDashboardStore((s) => s.renamePlan)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(plan.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function save() {
    const trimmed = value.trim()
    if (trimmed && trimmed !== plan.name) {
      renamePlan(plan.id, trimmed)
    } else {
      setValue(plan.name)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') { setValue(plan.name); setEditing(false) }
        }}
        className="w-full rounded border border-greentop-green bg-greentop-bg px-2 py-0.5 text-sm font-semibold text-greentop-text outline-none focus:ring-1 focus:ring-greentop-green"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="truncate text-left text-sm font-semibold text-greentop-text hover:text-greentop-green"
    >
      {plan.name}
    </button>
  )
}

// ── Plan card ───────────────────────────────────────────────────────────────
function PlanCard({ plan }: { plan: SavedPlan }) {
  const router = useRouter()
  const deletePlan = useDashboardStore((s) => s.deletePlan)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      deletePlan(plan.id)
    } else {
      setConfirmDelete(true)
      // Auto-reset after 3 s
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }, [confirmDelete, deletePlan, plan.id])

  const m = plan.dashboard.keyMetrics
  const rec = plan.dashboard.recommendedOption

  return (
    <div className="flex flex-col rounded-2xl border border-greentop-border bg-greentop-surface transition-colors hover:border-greentop-green/40">
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 border-b border-greentop-border p-4">
        <div className="min-w-0 flex-1">
          <EditableName plan={plan} />
          <p className="mt-0.5 flex items-center gap-1 text-xs text-greentop-muted">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{plan.building.address}</span>
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${categoryColor(rec.category)}`}>
          {rec.category}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm font-medium text-greentop-text">{plan.selectedOption.name}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-greentop-border bg-greentop-bg p-2.5 text-center">
            <p className="font-mono text-sm font-bold text-greentop-green">{money(m.annualSavings)}<span className="text-[10px] text-greentop-muted">/yr</span></p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wide text-greentop-muted">Annual savings</p>
          </div>
          <div className="rounded-xl border border-greentop-border bg-greentop-bg p-2.5 text-center">
            <p className="font-mono text-sm font-bold text-greentop-green">{m.roiPercent != null ? `${m.roiPercent}%` : '—'}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wide text-greentop-muted">ROI</p>
          </div>
        </div>

        <p className="text-[11px] text-greentop-muted">Created {formatDate(plan.createdAt)}</p>
      </div>

      {/* Card actions */}
      <div className="flex items-center gap-2 border-t border-greentop-border p-4">
        <button
          onClick={() => router.push(`/plan/${plan.id}`)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-greentop-green/10 px-3 py-2.5 text-xs font-semibold text-greentop-green transition-colors hover:bg-greentop-green/20"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View Plan
        </button>
        <button
          onClick={handleDelete}
          title={confirmDelete ? 'Click again to confirm deletion' : 'Delete plan'}
          className={`flex items-center justify-center rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
            confirmDelete
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-greentop-border/30 text-greentop-muted hover:bg-greentop-border/60 hover:text-greentop-text'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmDelete ? <span className="ml-1">Confirm?</span> : null}
        </button>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const plans = useDashboardStore((s) => s.plans)

  useEffect(() => {
    if (!user) {
      router.replace('/login')
    }
  }, [user, router])

  if (!user) return null

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen w-full bg-greentop-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-greentop-border bg-greentop-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-greentop-green/40 bg-greentop-green/10">
              <Leaf className="h-4 w-4 text-greentop-green" />
            </div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-greentop-green">GreenTop</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-greentop-text">{user.name}</p>
              <p className="text-xs text-greentop-muted">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="flex items-center gap-1.5 rounded-lg border border-greentop-border px-3 py-2 text-xs text-greentop-muted transition-colors hover:border-greentop-green/50 hover:text-greentop-text"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-greentop-text">Your Roof Plans</h1>
            <p className="mt-1 text-sm text-greentop-muted">
              {plans.length === 0
                ? 'No saved plans yet — analyze a rooftop to get started.'
                : `${plans.length} saved plan${plans.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            onClick={() => router.push('/map')}
            className="flex items-center gap-2 rounded-xl bg-greentop-green px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Analyze Another Roof
          </button>
        </div>

        {plans.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-greentop-border bg-greentop-surface/50 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-greentop-green/30 bg-greentop-green/10">
              <Leaf className="h-8 w-8 text-greentop-green" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-greentop-text">No plans yet</h2>
            <p className="mt-2 max-w-xs text-sm text-greentop-muted">
              Search for a building on the map, run the GreenTop analysis, and save your first roof plan.
            </p>
            <button
              onClick={() => router.push('/map')}
              className="mt-6 flex items-center gap-2 rounded-xl bg-greentop-green px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <MapPin className="h-4 w-4" />
              Find a Rooftop
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}

        {plans.length > 0 && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => router.push('/map')}
              className="flex items-center gap-2 rounded-xl bg-greentop-green px-7 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-5 w-5" />
              Analyze Another Roof
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
