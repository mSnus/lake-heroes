import React, { useEffect, useState } from 'react';

const GameMessage: React.FC<{ message: string }> = ({ message }) => {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [message]);

  if (!message || dismissed) return <div />;
  return (
    <div className="game-message" onClick={() => setDismissed(true)}>
      <div className='game-message-text'>
        {message}
      </div>
    </div>
  );
};

export default GameMessage;
