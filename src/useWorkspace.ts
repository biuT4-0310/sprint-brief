import { useEffect, useRef, useState } from 'react'
import { isDraftConflict } from './drafts.ts'
import type { DraftStore, Workspace } from './drafts.ts'
import { exampleDeck, EXAMPLE_INPUT } from './example.ts'

export type SaveStatus = 'idle' | 'restored' | 'saving' | 'saved' | 'failed' | 'unavailable' | 'conflict'

export function useWorkspace(store: DraftStore | null | undefined) {
  const [workspace, setWorkspace] = useState<Workspace>(() => ({ input: { ...EXAMPLE_INPUT }, deck: exampleDeck(), edited: false }))
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  const [canSave, setCanSave] = useState(false)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const writes = useRef(Promise.resolve())
  const conflict = useRef(false)

  useEffect(() => {
    if (store === undefined) return
    let active = true
    if (!store) {
      setStatus('unavailable')
      setReady(true)
      return
    }
    store.load().then(saved => {
      if (!active) return
      if (saved) {
        setWorkspace(saved)
        setStatus('restored')
      }
      setCanSave(true)
    }).catch(() => {
      if (active) setStatus('unavailable')
    }).finally(() => {
      if (active) setReady(true)
    })
    return () => { active = false }
  }, [store])

  useEffect(() => {
    if (!store || !canSave || !revision) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      writes.current = writes.current.then(async () => {
        if (cancelled) return
        if (conflict.current) {
          setStatus('conflict')
          return
        }
        try {
          await store.save(workspace)
          if (!cancelled) setStatus('saved')
        } catch (error) {
          if (isDraftConflict(error)) conflict.current = true
          if (!cancelled) setStatus(conflict.current ? 'conflict' : 'failed')
        }
      })
    }, 420)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [workspace, revision, store, canSave])

  useEffect(() => {
    if (status !== 'saving') return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [status])

  function queueSave() {
    setStatus(conflict.current ? 'conflict' : canSave ? 'saving' : 'unavailable')
    setRevision(value => value + 1)
  }

  function write(update: Workspace | ((current: Workspace) => Workspace)) {
    setWorkspace(update)
    queueSave()
  }

  return { workspace, write, ready, status, retry: queueSave }
}
