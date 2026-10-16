import React, { useEffect } from 'react';
import '../../styles/modal.css';

interface GameModalProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  backgroundImage?: string;
  noBorder?: boolean;
}

const GameModal: React.FC<GameModalProps> = ({
  children,
  className,
  style,
  backgroundImage,
  noBorder,
}) => {
  useEffect(() => {
    // When the modal is mounted, disable scrolling on the body
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // When the modal is unmounted, restore the original body overflow style
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []); // The empty dependency array ensures this effect runs only on mount and unmount

  // This modal is always "open" when rendered, its parent controls rendering.
  // The outer div is the semi-transparent overlay.
  // We stop propagation on the content's click so it doesn't close if an overlay click handler is ever added.
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="game-modal-wrapper"
      style={
        backgroundImage
          ? {
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <div className="game-modal">
        {noBorder ? (
          <div
            className={`modal-content ${className || ''}`}
            style={style}
            onClick={handleContentClick}
          >
            {children}
          </div>
        ) : (
          <div className="game-modal-border" style={{ backgroundImage: `url('assets/sand.jpg')` }}>
            <div
              className={`modal-content modal-background ${className || ''}`}
              style={style}
              onClick={handleContentClick}
            >
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameModal;
