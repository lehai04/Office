import type { OfficeMood } from '../utils/officeSocial';

const faces: Record<OfficeMood, { color: string; marks: string; accent?: { color: string; marks: string } }> = {
  happy: {
    color: '#ffc638',
    marks: 'M3 7h1V6h2v1h1v1H6V7H4v1H3z M9 7h1V6h2v1h1v1h-1V7h-2v1H9z M5 10h1v1h4v-1h1v2h-1v1H6v-1H5z',
  },
  sad: {
    color: '#5188ef',
    marks: 'M3 7h3v1H3z M10 7h3v1h-3z M5 12v-1h1v-1h4v1h1v1h-2v-1H7v1z',
    accent: { color: '#4be8fa', marks: 'M13 9h1v1h1v2h-1v1h-1v-1h-1v-2h1z' },
  },
  curt: {
    color: '#ffae30',
    marks: 'M3 6h4v1H6v1H4V7H3z M9 6h4v1h-1v1h-2V7H9z M6 10h4v1H6z',
  },
  grumpy: {
    color: '#ff626d',
    marks: 'M3 5h2v1h1v1h1v1H5V7H4V6H3z M13 5h-2v1h-1v1H9v1h2V7h1V6h1z M5 12v-2h1V9h4v1h1v2h-2v-1H7v1z',
  },
  love: {
    color: '#f998c9',
    marks: 'M6 10h1v1h2v-1h1v2H6z',
    accent: { color: '#bd174d', marks: 'M3 5h1v1h1V5h1v1h1v2H6v1H5v1H4V9H3V8H2V6h1z M10 5h1v1h1V5h1v1h1v2h-1v1h-1v1h-1V9h-1V8H9V6h1z' },
  },
  hate: {
    color: '#b47aef',
    marks: 'M3 6h4v1H5v1H4V7H3z M10 6h4v1h-2v1h-1V7h-1z M7 11h2v-1h3v1H9v1H7z',
  },
};

export function PixelMoodIcon({ mood, className }: { mood: OfficeMood; className?: string }) {
  const face = faces[mood];
  return <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} aria-hidden="true">
    <path fill={face.color} d="M3 1h10v1h1v1h1v10h-1v1h-1v1H3v-1H2v-1H1V3h1V2h1z" />
    <path fill="#311439" d={face.marks} />
    {face.accent && <path fill={face.accent.color} d={face.accent.marks} />}
  </svg>;
}
