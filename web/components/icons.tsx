import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const iconProps = {
  'aria-hidden': true,
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 1.8,
  viewBox: '0 0 24 24',
};

export const ArrowUpRightIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="M7 17 17 7M7 7h10v10" />
  </svg>
);

export const ChevronRightIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const CloseIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CommandIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="M9 6V5a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V5" />
  </svg>
);

export const HeadphonesIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <path d="M18 19h1a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-1v6ZM6 19H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h1v6Z" />
  </svg>
);

export const MenuIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const MoonIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" />
  </svg>
);

export const QueueIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="M4 6h12M4 12h10M4 18h8" />
    <path d="m17 15 4 3-4 3v-6Z" />
  </svg>
);

export const SparklesIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
    <path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
  </svg>
);

export const SunIcon = (props: IconProps) => (
  <svg {...iconProps} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
