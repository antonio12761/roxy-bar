import { useState, useEffect } from 'react';

/**
 * Hook che ritarda l'aggiornamento di un valore finché non passa un certo periodo di tempo
 * senza che il valore cambi. Utile per evitare chiamate API eccessive durante la digitazione.
 * 
 * @param value - Il valore da debounce
 * @param delay - Il ritardo in millisecondi
 * @returns Il valore debouncato
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}