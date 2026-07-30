import React from 'react';
import { t } from './index';

/**
 * Like `t`, but values can be React nodes (e.g. a styled <span className="value">)
 * instead of just strings/numbers. Splits the translated template on
 * `{placeholder}` markers and splices in the given nodes in whatever order
 * the template puts them — unlike naive prefix/suffix string concatenation,
 * this lets each language's word order differ around the interpolated values
 * (important for Russian, which doesn't always share English's word order).
 */
export function tJsx(key: string, values: Record<string, React.ReactNode>): React.ReactNode {
  const template = t(key);
  // String.split with a capturing group alternates [text, captured, text, captured, ..., text].
  const parts = template.split(/\{(\w+)\}/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <React.Fragment key={i}>{values[part] ?? `{${part}}`}</React.Fragment> : part
  );
}
