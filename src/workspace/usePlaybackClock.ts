/**
 * Subject-agnostic playback clock for stepwise canvas animation.
 * Currently a thin re-export of the existing useCanvasPlayback hook so
 * graphics behaviour is preserved bit-for-bit through Phase 1.
 */
export { useCanvasPlayback as usePlaybackClock } from '@/components/canvas/useCanvasPlayback';
