import { useModal } from '../utils/modalStore';
import DiceModal from './DiceModal';
import NewGameModal from './NewGameModal';
import { PlayerSetup } from '../utils/playerSetup';

export function ModalRenderer() {
  const { type, handler, key, rolling } = useModal();

  console.log('Rendering modal of type:', type);

  if (!type) return null;

  switch (type) {
    case 'dice':
      return <DiceModal key={key} rolling={rolling} onRoll={(roll) => (handler as (roll: number) => void)?.(roll)} />;
    case 'new-game':
      return <NewGameModal onStart={handler as (players: PlayerSetup[]) => void} />;
    default:
      if (type) console.warn(`Unknown modal type: ${type}`);
      return null;
  }
}
