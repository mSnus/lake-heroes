import riderRed from '../../public/assets/rider-red.png';
import riderBlue from '../../public/assets/rider-blue.png';
import riderYellow from '../../public/assets/rider-yellow.png';
import riderGreen from '../../public/assets/rider-green.png';
import riderViolet from '../../public/assets/rider-violet.png';
import riderBlack from '../../public/assets/rider-black.png';

export interface PlayerOption {
  colorName: string;
  color: string;
  image: string;
  asset: string;
}

export const playerOptions: PlayerOption[] = [
  { colorName: 'Red', color: '#FF4444', image: 'rider-red.png', asset: riderRed },
  { colorName: 'Blue', color: '#4444FF', image: 'rider-blue.png', asset: riderBlue },
  { colorName: 'Yellow', color: '#FFD700', image: 'rider-yellow.png', asset: riderYellow },
  { colorName: 'Green', color: '#00C851', image: 'rider-green.png', asset: riderGreen },
  { colorName: 'Violet', color: '#9933CC', image: 'rider-violet.png', asset: riderViolet },
  { colorName: 'Black', color: '#212121', image: 'rider-black.png', asset: riderBlack },
];

export const playerImageAssets: Record<string, string> = playerOptions.reduce(
  (acc, option) => {
    acc[option.image] = option.asset;
    return acc;
  },
  {} as Record<string, string>
);
