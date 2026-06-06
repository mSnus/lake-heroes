import { useModal } from '../utils/diceStore';
import DiceModal from './DiceModal';

export function ModalRenderer() {
  const { active, handler, key, rolling } = useModal();

  if (!active) return null;

  return (
    <DiceModal
      key={key}
      rolling={rolling}
      onRoll={(roll) => (handler as (roll: number) => void)?.(roll)}
    />
  );
}
