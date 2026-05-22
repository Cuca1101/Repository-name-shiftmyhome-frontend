import { useCallback, useEffect, useState } from 'react'
import {
  coerceUseHeroVideo,
  normalizeHeroVideoUrl,
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
 * }} props
 */
export default function HeroBackgroundMedia({
  imageUrl,
  videoUrl = '',
  useVideo = false,
  imageAriaLabel = 'Professional home removals',
}) {
  const playbackUrl = resolveHeroVideoPlaybackUrl(videoUrl)
  const wantsVideo = coerceUseHeroVideo(useVideo) && playbackUrl.length > 0
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
    <>
      <div
        className="absolute inset-0 z-0 bg-cover bg-[center_42%] transition-transform duration-700 ease-premium lg:hover:scale-[1.02]"
        style={{ backgroundImage: `url(${imageUrl})` }}
        role="img"
        aria-label={imageAriaLabel}
      />
      {showVideo ? (
        <video
          ref={attachVideoRef}
          key={playbackUrl}
          className="absolute inset-0 z-[1] h-full w-full object-cover object-[center_right]"
          src={playbackUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          onLoadedData={(e) => {
            const el = e.currentTarget
            el.muted = true
            void el.play().catch(() => {})
          }}
          onError={() => setVideoFailed(true)}
        />
      ) : null}
      <div className="hero-image-fade absolute inset-0 z-[2] lg:hidden" aria-hidden />
      <div className="hero-media-overlay-desktop absolute inset-0 z-[2] hidden lg:block" aria-hidden />
    </>
  )
}
