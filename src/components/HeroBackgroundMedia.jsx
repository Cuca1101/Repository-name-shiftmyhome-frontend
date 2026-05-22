import { useCallback, useEffect, useState } from 'react'
import {
  coerceUseHeroVideo,
  heroVideoMimeFromUrl,
  resolveHeroVideoPlaybackUrl,
} from '../lib/heroCmsVideo'

/**
 * Homepage hero background — image fallback with optional CMS video on top.
 *
 * @param {{
 *   imageUrl: string,
 *   videoUrl?: string,
 *   useVideo?: boolean,
 *   imageAriaLabel?: string,
 *   overlay?: 'none' | 'panel-edge',
 * }} props
 */
export default function HeroBackgroundMedia({
  imageUrl,
  videoUrl = '',
  useVideo = false,
  imageAriaLabel = 'Professional home removals',
  overlay = 'none',
}) {
  const playbackUrl = resolveHeroVideoPlaybackUrl(videoUrl)
  const wantsVideo = coerceUseHeroVideo(useVideo) && playbackUrl.length > 0
  const videoMime = heroVideoMimeFromUrl(playbackUrl)
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => {
    setVideoFailed(false)
  }, [playbackUrl, useVideo])

  const showVideo = wantsVideo && !videoFailed

  const attachVideoRef = useCallback(
    (node) => {
      if (!node || !showVideo) return
      node.muted = true
      node.defaultMuted = true
      node.setAttribute('playsinline', '')
      node.setAttribute('webkit-playsinline', '')
      const attempt = node.play()
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => {})
      }
    },
    [showVideo],
  )

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="hero-bg-image absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${imageUrl})` }}
        role="img"
        aria-label={imageAriaLabel}
      />
      {showVideo ? (
        <video
          ref={attachVideoRef}
          key={playbackUrl}
          className="hero-bg-video absolute inset-0 z-[1] h-full w-full"
          src={playbackUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          onLoadedData={(e) => {
            const el = e.currentTarget
            el.muted = true
            void el.play().catch(() => {})
          }}
          onError={() => setVideoFailed(true)}
        >
          <source src={playbackUrl} type={videoMime || 'video/mp4'} />
        </video>
      ) : null}
      {overlay === 'panel-edge' ? (
        <div className="hero-media-panel-edge absolute inset-0 z-[2]" aria-hidden />
      ) : null}
    </div>
  )
}
