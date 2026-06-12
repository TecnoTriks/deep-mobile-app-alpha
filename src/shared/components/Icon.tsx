import Svg, { Path, type SvgProps } from 'react-native-svg';

type IconProps = SvgProps & {
  size?: number;
};

function base(props: IconProps) {
  const { size = 20, ...rest } = props;
  return { height: size, width: size, ...rest } as SvgProps;
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...base(props)}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Svg>
  );
}

export function LocationIcon(props: IconProps) {
  return (
    <Svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...base(props)}>
      <Path d="M12 22s-7-7.58-7-13a7 7 0 1 1 14 0c0 5.42-7 13-7 13z" />
      <Path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
    </Svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...base(props)}>
      <Path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <Path d="M21 3v5h-5" />
      <Path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <Path d="M3 21v-5h5" />
    </Svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...base(props)}>
      <Path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.5-2h6L16.5 6h2A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" />
      <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </Svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...base(props)}>
      <Path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <Path d="M21 15l-5-5L5 21" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...base(props)}>
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function ErrorIcon(props: IconProps) {
  return (
    <Svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...base(props)}>
      <Path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </Svg>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...base(props)}>
      <Path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <Path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
      <Path d="M9 12h6" />
      <Path d="M9 16h4" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" {...base(props)}>
      <Path d="M3 6h18" />
      <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
    </Svg>
  );
}
