'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { preload } from 'react-dom';
import { useReducedMotion } from 'motion/react';
import { useSiteConfig } from '@/hooks/use-site-config';
import { siteConfig as defaultSiteConfig } from '@/content/site';
import { GoldGlint } from './GoldGlint';
import './opening-card.css';

/** Screens that get the opening card when `openingCard.mobileOnly` is on */
export const OPENING_CARD_MOBILE_MEDIA = '(max-width: 767px)';

// Choreography after the tap (ms) — keep in sync with the delays in opening-card.css
//   0–1200    light runs up through the gold filigree (GoldGlint, WebGL)
//   0–200     tail is tugged: the knot squeezes, the tails pull taut
//   150–750   the loops are drawn back into the knot
//   450–900   the knot loosens and twists free
//   550–1250  ribbon band halves glide off the card edges; tails slip down and away
//   1000–2350 a point of light kindles at the seam's centre, runs up and down the crack and
//             warms the doors' inner edges
//   1750–3850 latch gives, the doors swing open on their hinges (3D); rays and sparkles
//             pour out of the opening and the light fades onto the invitation
const GLINT_MS = 1200;

// Sparkles that drift out of the opening doors (deterministic, so SSR and client agree)
const MOTES = Array.from({ length: 22 }, (_, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  return {
    y: 30 + ((i * 37) % 41), // start along the middle of the seam
    size: 3 + ((i * 7) % 5),
    dx: side * (16 + ((i * 13) % 34)),
    dy: -14 + ((i * 29) % 30) - (i % 3 === 0 ? 12 : 0), // mostly drifting up and out
    dur: 1.4 + ((i * 11) % 9) / 10,
    delay: ((i * 7) % 10) / 20,
  };
});
// Mount the LoadingScreen once the gold glint (JS-driven) has finished but before the doors
// move: its first render blocks the main thread for a moment, which would freeze the glint,
// while the CSS seam light keeps running on the compositor and the closed doors hide the mount
const LOADER_START_MS = 1250;
const DONE_MS = 3900;
const REDUCED_LOADER_START_MS = 0;
const REDUCED_DONE_MS = 600;

interface OpeningCardProps {
  /** Fires before the doors swing, while the card still covers the screen — mount whatever the doors reveal */
  onOpenStart?: () => void;
  /** Fires once the doors are fully open; unmount the card here */
  onOpened: () => void;
  /** Overrides `openingCard.hintText` from content/site.ts */
  hint?: string;
}

export const OpeningCard: React.FC<OpeningCardProps> = ({ onOpenStart, onOpened, hint }) => {
  // Artwork + text come from `openingCard` in content/site.ts; fall back to the bundled config
  // if a remote override is missing the block (or some of its images)
  const siteConfig = useSiteConfig();
  const defaults = defaultSiteConfig.openingCard;
  const content = siteConfig.openingCard ?? defaults;
  const img = { ...defaults.images, ...content.images };
  const src = (path: string) => (path ? encodeURI(path) : '');
  const IMG = {
    card: src(img.card),
    bow: src(img.bow),
    ribbonLeft: src(img.ribbonLeft),
    ribbonRight: src(img.ribbonRight),
    knot: src(img.knot),
    paper: src(img.paper),
    goldMap: src(img.goldMap),
  };
  const hintText = hint ?? content.hintText ?? defaults.hintText;
  const ribbonY = content.ribbonY || defaults.ribbonY;

  const mobileOnly = content.mobileOnly ?? defaults.mobileOnly;

  // Start fetching the artwork with the HTML so the card is never painted blank
  // (phones only when mobileOnly — desktop never shows the card, so never downloads it)
  // (the card art and bow first — they are what the guest sees)
  for (const path of [IMG.card, IMG.bow, IMG.ribbonLeft, IMG.ribbonRight, IMG.knot]) {
    if (!path) continue;
    preload(path, {
      as: 'image',
      ...((path === IMG.card || path === IMG.bow) && { fetchPriority: 'high' as const }),
      ...(mobileOnly && { media: OPENING_CARD_MOBILE_MEDIA }),
    });
  }

  const reduceMotion = useReducedMotion();
  const [opening, setOpening] = useState(false);
  // Falls back to the CSS shimmer when WebGL (or the gold map) isn't available
  const [glintFallback, setGlintFallback] = useState(false);
  const handleGlintUnavailable = useCallback(() => setGlintFallback(true), []);
  const openingRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const pending = timers.current;
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      pending.forEach(clearTimeout);
    };
  }, []);

  const open = useCallback(() => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    timers.current.push(
      setTimeout(() => onOpenStart?.(), reduceMotion ? REDUCED_LOADER_START_MS : LOADER_START_MS),
      setTimeout(onOpened, reduceMotion ? REDUCED_DONE_MS : DONE_MS),
    );
  }, [onOpenStart, onOpened, reduceMotion]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  return (
    <div
      className={`opening-card${mobileOnly ? ' opening-card--mobile-only' : ''}${opening ? ' is-opening' : ''}${reduceMotion ? ' is-reduced-motion' : ''}${glintFallback || !IMG.goldMap ? ' opening-card--no-glint' : ''}`}
      style={
        {
          '--oc-card': IMG.card ? `url("${IMG.card}")` : 'none',
          '--oc-paper': IMG.paper ? `url("${IMG.paper}")` : 'none',
          '--oc-band-y': ribbonY,
        } as React.CSSProperties
      }
    >
      <div
        className="opening-card__stage"
        role="button"
        tabIndex={0}
        aria-label="Open invitation"
        aria-disabled={opening}
        onClick={open}
        onKeyDown={onKeyDown}
      >
        {/* Light inside the card — a bright core and slowly turning rays, revealed as the doors part */}
        <div className="opening-card__light" aria-hidden="true" />
        <div className="opening-card__rays" aria-hidden="true" />

        {/* Gate-fold doors on outer hinges — card art on the front, cream paper inside,
            a visible board edge, and shading/gloss that follow the swing */}
        <div className="opening-card__scene" aria-hidden="true">
          {(['left', 'right'] as const).map((side) => (
            <div key={side} className={`opening-card__door opening-card__door--${side}`}>
              <div className="opening-card__door-face">
                <div className="opening-card__door-art" />
                <div className="opening-card__door-shade" />
                <div className="opening-card__door-gloss" />
                <div className="opening-card__door-rim" />
              </div>
              <div className="opening-card__door-edge" />
              <div className="opening-card__door-back" />
            </div>
          ))}
        </div>

        {/* Light kindling at the centre of the seam and leaking through the crack */}
        <div className="opening-card__seam" aria-hidden="true" />
        <div className="opening-card__flare" aria-hidden="true" />
        {!reduceMotion && (
          <div className="opening-card__motes" aria-hidden="true">
            {MOTES.map((m, i) => (
              <span
                key={i}
                className="opening-card__mote"
                style={
                  {
                    '--y': `${m.y}%`,
                    '--s': `${m.size}px`,
                    '--dx': `${m.dx}cqw`,
                    '--dy': `${m.dy}cqh`,
                    '--dur': `${m.dur}s`,
                    '--delay': `${m.delay}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}

        {/* Light running up through the gold filigree on tap (CSS shimmer as a fallback) */}
        {!reduceMotion && !glintFallback && IMG.goldMap && (
          <GoldGlint
            src={IMG.goldMap}
            media={mobileOnly ? OPENING_CARD_MOBILE_MEDIA : undefined}
            active={opening}
            durationMs={GLINT_MS}
            className="opening-card__glint"
            onUnavailable={handleGlintUnavailable}
          />
        )}
        <div className="opening-card__shimmer" aria-hidden="true" />

        {/* Ribbon band wrapped around the card: two ends meeting under the bow */}
        <div className="opening-card__ribbon" aria-hidden="true">
          <div className="opening-card__ribbon-end opening-card__ribbon-end--left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.ribbonLeft} alt="" loading="lazy" draggable={false} />
          </div>
          <div className="opening-card__ribbon-end opening-card__ribbon-end--right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.ribbonRight} alt="" loading="lazy" draggable={false} />
          </div>
        </div>

        {/* Bow, split so it can untie: loops draw back into the knot while the tails slip away;
            the close-up knot (muhur) sits over the bow's own knot and loosens on its own */}
        <div className="opening-card__bow" aria-hidden="true">
          <div className="opening-card__bow-part opening-card__bow-part--tails">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.bow} alt="" className="opening-card__bow-img" loading="lazy" draggable={false} fetchPriority="high" />
          </div>
          <div className="opening-card__bow-part opening-card__bow-part--loops">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG.bow} alt="" className="opening-card__bow-img" loading="lazy" draggable={false} />
          </div>
          <span className="opening-card__knot-glow" />
          {IMG.knot && (
            <div className="opening-card__seal">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.knot} alt="" loading="lazy" draggable={false} />
            </div>
          )}
        </div>

        <p className="opening-card__hint" aria-hidden="true">
          {hintText}
        </p>
      </div>
    </div>
  );
};
