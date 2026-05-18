import { type CSSProperties, type ReactElement, type ReactNode, type SVGProps } from 'react';

export type IconProps = {
  size?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<SVGProps<SVGSVGElement>, 'stroke' | 'fill' | 'strokeWidth' | 'style' | 'children'>;

export function Icon({
  size = 18,
  stroke = 'currentColor',
  fill = 'none',
  strokeWidth = 1.7,
  style,
  children,
  ...rest
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      {...rest}
    >
      {children}
    </svg>
  );
}

type LineIcon = (props: Omit<IconProps, 'children'>) => ReactElement;

const make = (paths: ReactNode): LineIcon => (props) =>
  <Icon {...props}>{paths}</Icon>;

export const IconClock      = make(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>);
export const IconFlame      = make(<path d="M12 3c1.5 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.8-2.5 1.5-3.2C10 9 11 7 12 3z"/>);
export const IconEuro       = make(<path d="M17 6.5A6 6 0 0 0 8 9m9 8.5A6 6 0 0 1 8 15M5 10h8M5 13.5h8"/>);
export const IconKid        = make(<><circle cx="12" cy="9" r="4"/><path d="M5.5 20c1-3.5 4-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="10" cy="9" r=".7" fill="currentColor"/><circle cx="14" cy="9" r=".7" fill="currentColor"/></>);
export const IconRepeat     = make(<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16M21 4v4h-4M3 20v-4h4"/>);
export const IconCheck      = make(<path d="M4 12.5l5 5L20 6.5"/>);
export const IconPlus       = make(<path d="M12 5v14M5 12h14"/>);
export const IconMore       = make(<><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/></>);
export const IconChev       = make(<path d="M9 6l6 6-6 6"/>);
export const IconChevDown   = make(<path d="M6 9l6 6 6-6"/>);
export const IconAlert      = make(<><path d="M12 4l9.5 16h-19L12 4z"/><path d="M12 10v4M12 17.2v.1"/></>);
export const IconHeart      = make(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>);
export const IconCross      = make(<path d="M6 6l12 12M18 6L6 18"/>);
export const IconEdit       = make(<path d="M14 5l5 5L9 20H4v-5L14 5z"/>);
export const IconTag        = make(<><path d="M3 12l9-9h8v8l-9 9-8-8z"/><circle cx="15" cy="9" r="1.4"/></>);
export const IconCart       = make(<><path d="M3 5h2l2.5 11.5a2 2 0 0 0 2 1.5h7.5a2 2 0 0 0 2-1.5L21 8H7"/><circle cx="10" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></>);
export const IconBook       = make(<><path d="M4 5a2 2 0 0 1 2-2h13v16H7a3 3 0 0 0-3 3V5z"/><path d="M7 17h12"/></>);
export const IconPeople     = make(<><circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 19c.7-3 3-4.5 5.5-4.5S13.8 16 14.5 19M14.5 14.5c2 0 4 1 5 3.5"/></>);
export const IconPlan       = make(<><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></>);
export const IconShare      = make(<><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/></>);
export const IconRefresh    = make(<><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/></>);
export const IconBowl       = make(<><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M7 8c1-1 2-1 3 0M12 6c1-1 2-1 3 0M17 8c1-1 2-1 3 0"/></>);
export const IconBag        = make(<><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>);
export const IconSearch     = make(<><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></>);
export const IconHome       = make(<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4v-9z"/>);
export const IconStar       = make(<path d="M12 4l2.4 5 5.6.8-4 4 1 5.6L12 16.8 6.9 19.4l1-5.6-4-4L9.6 9 12 4z"/>);
export const IconThumb      = make(<path d="M7 10h3V4l4 6v9H8a3 3 0 0 1-3-3v-3a3 3 0 0 1 2-3z"/>);
export const IconCopy       = make(<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></>);
export const IconSend       = make(<path d="M22 3L11 14M22 3l-7 18-4-7-7-4 18-7z"/>);
export const IconLink       = make(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></>);
export const IconPin        = make(<><path d="M12 21s7-7.5 7-12a7 7 0 0 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></>);
export const IconPaperclip  = make(<path d="M19 11l-7.5 7.5a4.5 4.5 0 1 1-6.4-6.4L13 4.5a3 3 0 0 1 4.2 4.2l-8 8a1.5 1.5 0 1 1-2.1-2.1L14 8"/>);
