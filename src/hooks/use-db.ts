import { useSyncExternalStore } from 'react';
import { salud } from '@/services/storage';

/** Número de escrituras fallidas en localStorage. */
export const useFallosAlmacenamiento = () => useSyncExternalStore(salud.subscribe, salud.getSnapshot, salud.getSnapshot);
