import { useEffect, useState } from 'react';

export function useMediaQuery(query: string) {
  const [coincide, setCoincide] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const al = () => setCoincide(mq.matches);
    al();
    mq.addEventListener('change', al);
    return () => mq.removeEventListener('change', al);
  }, [query]);
  return coincide;
}
