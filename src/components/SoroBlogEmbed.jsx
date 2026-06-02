import { useEffect } from 'react'
import { loadSoroBlogEmbedScript } from '../lib/soroBlogEmbed.js'

/**
 * Mount point for the Soro blog widget. Script is injected once globally.
 */
export default function SoroBlogEmbed({ className = '' }) {
  useEffect(() => {
    loadSoroBlogEmbedScript()
  }, [])

  return <div id="soro-blog" className={className} />
}
