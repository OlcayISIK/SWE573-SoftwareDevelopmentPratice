import { useEffect, useState } from "react";

/** The value once it has stopped changing for `delay` milliseconds. */
export function useDebouncedValue<T>(value: T, delay = 400) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
