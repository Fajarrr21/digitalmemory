import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

const s = (children: React.ReactNode) =>
  function Icon(props: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  };

const HomeIcon = s(
  <>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 9.5V20h12V9.5" />
  </>,
);
const DiaryIcon = s(
  <>
    <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2Z" />
    <path d="M6 4a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2" />
    <path d="M10 8.5h5M10 12h5" />
  </>,
);
const CalendarIcon = s(
  <>
    <rect x="4" y="5" width="16" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </>,
);
const HeartIcon = s(
  <path d="M12 20s-6.5-4.3-9-8.2C1.4 9 2.5 5.7 5.7 5.2 7.8 4.9 9.4 6 12 8.6c2.6-2.6 4.2-3.7 6.3-3.4 3.2.5 4.3 3.8 2.7 6.6C18.5 15.7 12 20 12 20Z" />,
);

export type NavItem = {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.ReactElement;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/diary", label: "Diary", Icon: DiaryIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/us", label: "Us", Icon: HeartIcon },
];
