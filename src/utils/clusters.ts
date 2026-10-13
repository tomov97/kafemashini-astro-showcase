export type Cluster = 'repair' | 'buying' | 'hub';

export interface ClusterStyle {
  label: string;
  bgClass: string;
  // Single-path icon (square viewBox 0 0 20 20), rendered white inside the card band.
  iconPath: string;
}

export const clusterStyles: Record<Cluster, ClusterStyle> = {
  hub: {
    label: 'Поддръжка',
    bgClass: 'bg-primary',
    iconPath: 'M10 2a1 1 0 011 1v1.05A7.002 7.002 0 0117 11a1 1 0 11-2 0 5 5 0 00-4-4.9V8a1 1 0 11-2 0V6.1A5 5 0 005 11a1 1 0 11-2 0 7.002 7.002 0 016-6.95V3a1 1 0 011-1zM4.22 15.78a1 1 0 011.42 0A5 5 0 0010 17a5 5 0 004.36-1.22 1 1 0 111.28 1.54A7 7 0 013 16.5a1 1 0 011.22-.72z',
  },
  repair: {
    label: 'Ремонт',
    bgClass: 'bg-primary-dark',
    iconPath: 'M14.7 6.3a1 1 0 000-1.4l-1.6-1.6a1 1 0 00-1.4 0l-1.2 1.2 3 3 1.2-1.2zM3 14.5V17h2.5l7.4-7.4-2.5-2.5L3 14.5z',
  },
  buying: {
    label: 'Купуване',
    bgClass: 'bg-primary-light',
    iconPath: 'M3 3a1 1 0 000 2h1.2l.4 2 1.2 6.4a2 2 0 002 1.6h6.4a2 2 0 002-1.94l.8-4.86a1 1 0 00-1-1.2H6.4l-.2-1A1 1 0 005.2 3H3zm4 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm7 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z',
  },
};
