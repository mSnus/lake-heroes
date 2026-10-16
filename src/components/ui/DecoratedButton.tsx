import React from 'react';

interface DecoratedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Background image for the decorated button. Defaults to assets/button.png. */
  image?: string;
}

/**
 * A button styled with the `.decorated` class and a background image.
 * Wrap in a `.button-group` (or pass a className) for layout.
 */
export const DecoratedButton: React.FC<DecoratedButtonProps> = ({
  image = 'assets/button.png',
  className,
  style,
  children,
  ...rest
}) => (
  <button
    {...rest}
    className={['decorated', className].filter(Boolean).join(' ')}
    style={{ backgroundImage: `url(${image})`, ...style }}
  >
    <div className="decorated-button-content">{children}</div>
  </button>
);

export default DecoratedButton;
