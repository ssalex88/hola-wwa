import type { ReactNode, SVGProps } from 'react'

type IconName = 'chat' | 'pin' | 'chevron' | 'sparkle' | 'home' | 'wallet' | 'help' | 'user' | 'bell' | 'clock' | 'bike' | 'arrow' | 'menu' | 'close' | 'calendar' | 'gift' | 'power' | 'refresh' | 'clipboard' | 'card'

const paths: Record<IconName, ReactNode> = {
  chat: <><path d="M21 11a8 8 0 0 1-8 8H6l-4 3 1.5-6A8 8 0 1 1 21 11Z" /><path d="M7 10h10M7 14h6" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  sparkle: <><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" /><path d="M9 21v-7h6v7" /></>,
  wallet: <><rect x="3" y="6" width="18" height="15" rx="3" /><path d="M3 10h18M6 6V4a1 1 0 0 1 1-1h11" /><path d="M17 15h2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 0 1 5.2 1c0 1.8-2.7 2.2-2.7 4" /><path d="M12 17h.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  bike: <><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="m5.5 17.5 5-10 4 10h-9M14.5 17.5l4-7h-5M9 6h3" /></>,
  arrow: <><path d="M4 12h16m-7-7 7 7-7 7" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <><path d="M5 5l14 14M19 5 5 19" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3" /></>,
  gift: <><rect x="3" y="10" width="18" height="11" rx="2" /><path d="M2 7h20v3H2zM12 7v14M12 7c-2-4-6-5-7-2-1 3 3 3 7 2ZM12 7c2-4 6-5 7-2 1 3-3 3-7 2Z" /></>,
  power: <><path d="M12 2v10M6.5 5.5a9 9 0 1 0 11 0" /></>,
  refresh: <><path d="M20 7V3l-3 3a8 8 0 0 0-13 4M4 17v4l3-3a8 8 0 0 0 13-4" /><path d="M20 3v5h-5M4 21v-5h5" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4" /></>,
  card: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 15h4" /></>,
}

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
