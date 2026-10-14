export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}

export function IconHand(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 13V7.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 11.5V6.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M14 12V8a1.5 1.5 0 0 1 3 0v6.5c0 3-2 5.5-5.5 5.5H10A4.5 4.5 0 0 1 5.5 15v-2.5a1.5 1.5 0 0 1 3 0" />
    </Icon>
  );
}

export function IconPlane(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 11 16-7-6 16-2.2-5.2L4 11Z" />
      <path d="m11.8 14.8 2.2 2.2" />
    </Icon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </Icon>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function IconArrow(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function IconGear(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.5l1.6 1.6M17.6 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.5l1.6-1.6M17.6 8.1l1.6-1.6" />
    </Icon>
  );
}

export function IconChat(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 16.5 4 20l4.2-1.4A8 8 0 1 0 6 16.5Z" />
    </Icon>
  );
}

type IconProps = { className?: string };

function Icon({ children, className = "h-6 w-6" }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
