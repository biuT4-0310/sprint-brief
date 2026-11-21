import { realpath, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const project = await realpath(fileURLToPath(new URL('..', import.meta.url)))
const bundle = join(project, 'bundle')
const resolved = await realpath(bundle).catch(error => {
  if (error.code === 'ENOENT') return null
  throw error
})

if (resolved && resolved !== bundle) throw new Error('The bundle path must be inside the project directory')
if (resolved) await rm(resolved, { recursive: true, force: true })
await build({ root: project })
