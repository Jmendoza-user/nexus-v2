/**
 * scheduler — cron ligero para monitores proactivos (Hito 4).
 *
 * Un único setInterval gestionado (cada 30min) que llama runDueMonitors().
 * NO levanta procesos extra (vive dentro del backend Express). Guard `running`
 * para que dos ticks NO se solapen (si una corrida tarda más de 30min, el
 * siguiente tick se salta). Arranca SOLO desde server.ts (no en tests / no en
 * el import de la app supertest).
 *
 * TODO-DEUDA(scheduler-bullmq): para escalar (varios workers, reintentos con
 *  backoff, visibilidad de jobs) migrar a BullMQ sobre el Redis ya disponible.
 *  Hoy un setInterval in-process es suficiente para el volumen esperado.
 */
import { runDueMonitors } from './monitor.js';

const INTERVAL_MS = 30 * 60 * 1000; // 30 min

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) {
    console.warn('[monitor-scheduler] tick anterior aún en curso; se omite este.');
    return;
  }
  running = true;
  try {
    const r = await runDueMonitors();
    if (r.checked > 0) {
      console.log(`[monitor-scheduler] revisados=${r.checked} disparados=${r.triggered} errores=${r.errors}`);
    }
  } catch (err) {
    console.error('[monitor-scheduler] error en tick:', (err as Error).message);
  } finally {
    running = false;
  }
}

/** Inicia el scheduler. Idempotente. No corre un tick inmediato (espera 30min). */
export function startMonitorScheduler(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), INTERVAL_MS);
  // No desreferenciar el timer del event loop forzaría el cierre; dejamos que
  // viva con el proceso. server.ts lo limpia en shutdown.
  console.log(`[monitor-scheduler] activo (cada ${INTERVAL_MS / 60000} min).`);
}

/** Detiene el scheduler (shutdown). */
export function stopMonitorScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
