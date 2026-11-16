'use client';

import React from 'react';
import { PhotoBackground } from '@/components/loader/invite-photo-backdrop';
import './loader-poster.css';

/*
 * Background shared by the poster loading screen and the envelope that follows it (Hero.tsx),
 * so the look carries straight across the hand-off: couple photos (the marquee runs on a page
 * clock, so both copies line up), a sky-blue → blush wash, a thin double gold frame and the
 * floral corners tucked into the screen corners.
 */

export interface PosterTheme {
  goldDark?: string;
  gold?: string;
  goldLight?: string;
  ink?: string;
  inkSoft?: string;
  washTop?: string;
  washBottom?: string;
}

/** CSS variables for the poster colors (loadingScreen.poster.theme) — set on the loader root and
 *  on the envelope screen, so both read the same palette. Unset values keep the CSS defaults. */
export function posterThemeVars(theme: PosterTheme | undefined): React.CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  const map: [keyof PosterTheme, string][] = [
    ['goldDark', '--lp-gold-1'],
    ['gold', '--lp-gold-2'],
    ['goldLight', '--lp-gold-3'],
    ['ink', '--lp-ink'],
    ['inkSoft', '--lp-ink-soft'],
    ['washTop', '--lp-wash-top'],
    ['washBottom', '--lp-wash-bottom'],
  ];
  for (const [key, cssVar] of map) {
    if (theme[key]) vars[cssVar] = theme[key] as string;
  }
  return vars as React.CSSProperties;
}

export interface PosterBackdropProps {
  photos: string[];
  desktopPhotos: string[];
  corners: { topLeft?: string; topRight?: string; bottomLeft?: string; bottomRight?: string };
  /** How much the photos are washed out (loadingScreen.poster.photoVeil) */
  veil?: number;
  className?: string;
}

export const PosterBackdrop: React.FC<PosterBackdropProps> = ({ photos, desktopPhotos, corners, veil = 0.35, className }) => (
  <div className={`lp-bd${className ? ` ${className}` : ''}`} aria-hidden="true">
    <PhotoBackground photos={photos} desktopPhotos={desktopPhotos} veil={veil} />
    <div className="lp-bd__wash" />
    <div className="lp-bd__frame" />
    {(
      [
        ['tl', corners.topLeft],
        ['tr', corners.topRight],
        ['bl', corners.bottomLeft],
        ['br', corners.bottomRight],
      ] as const
    )
      .filter(([, src]) => src)
      .map(([pos, src]) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={pos} src={src} alt="" className={`lp-bd__corner lp-bd__corner--${pos}`} draggable={false} />
      ))}
  </div>
);
