import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Props = {
  className?: string;
  children: ReactNode;
  'aria-labelledby'?: string;
};

/**
 * A section that fades in the first time it scrolls into view. Without
 * IntersectionObserver the content is simply shown.
 */
export function Reveal({ className, children, ...rest }: Props) {
  const element = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const node = element.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={element}
      className={`reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </section>
  );
}
