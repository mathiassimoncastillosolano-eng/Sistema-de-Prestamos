import { AnimatePresence, motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/use-theme';
import { DUR } from '@/lib/motion';

export function ThemeToggle({ className }: { className?: string }) {
  const { tema, alternar } = useTheme();
  const etiqueta = tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <Tip label={etiqueta}>
      <Button variant="ghost" size="icon" onClick={alternar} aria-label={etiqueta} className={className}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={tema} initial={{ opacity: 0, rotate: -30 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 30 }} transition={{ duration: DUR.fast }} className="grid place-items-center">
            {tema === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </motion.span>
        </AnimatePresence>
      </Button>
    </Tip>
  );
}
