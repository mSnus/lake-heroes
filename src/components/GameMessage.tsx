import React from 'react';

const GameMessage: React.FC<{ message: string }> = ({ message }) => {
  return message ? <div className="game-message">{message}</div> : <div></div>;
};

export default GameMessage;
