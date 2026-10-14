import { useSyncExternalStore } from 'react';
import { getDb, subscribe } from '@/services/store';
import { salud } from '@/services/storage';

/** Estado de datos actual; el componente se vuelve a renderizar cuando cambia. */
export const useDb = () => useSyncExternalStore(subscribe, getDb, getDb);
/** Número de escrituras fallidas en localStorage. */
export const useFallosAlmacenamiento = () => useSyncExternalStore(salud.subscribe, salud.getSnapshot, salud.getSnapshot);
