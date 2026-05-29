/**
 * scraper — scraping headless con Playwright (chromium del cache del VPS).
 *
 * Capacidad exclusiva de planes Pro/Team (Hito 4). Lanza chromium headless,
 * navega a una URL pública, extrae título + texto (y un selector opcional) y
 * CIERRA el browser SIEMPRE (try/finally) — nunca deja procesos colgados.
 *
 * ⛔ SSRF guard: rechaza localhost, loopback, IPs privadas y metadata de nube
 * ANTES de navegar. Esto evita que un usuario use el scraper para alcanzar
 * servicios internos del VPS (PostgreSQL, BGE :8100, el propio backend :3110,
 * Redis, etc.). Sólo http/https a hosts públicos.
 *
 * Timeout duro de 30s por navegación. Un único browser por llamada (sin pool):
 * el scraping es esporádico; un pool sería micro-optimización prematura.
 *
 * TODO-DEUDA(scrape-pool): pool de contextos reutilizables si el volumen sube.
 * TODO-DEUDA(scrape-render-budget): límite de recursos (bloquear imágenes/fuentes)
 *  para acelerar y abaratar; hoy carga la página completa.
 */
import { chromium, type Browser } from 'playwright-core';
import { lookup as dnsLookup } from 'node:dns';
import { promisify } from 'node:util';
import { env } from '../../lib/env.js';

const lookupAsync = promisify(dnsLookup);

const NAV_TIMEOUT_MS = 30_000;
const MAX_TEXT = 200_000; // recorte defensivo del texto extraído.

export class ScrapeError extends Error {
  constructor(public code: 'invalid_url' | 'ssrf_blocked' | 'nav_failed' | 'launch_failed', message: string) {
    super(message);
    this.name = 'ScrapeError';
  }
}

export interface ScrapeOptions {
  /** Selector CSS opcional: si se da, `extracted` trae su textContent. */
  selector?: string;
  /** Selector a esperar antes de extraer (para páginas con render diferido). */
  waitFor?: string;
}

export interface ScrapeResult {
  url: string;
  title: string;
  text: string;
  /** textContent del selector pedido (null si no se pidió o no existe). */
  extracted: string | null;
}

/** ¿La IP (v4/v6) es privada, loopback, link-local o metadata de nube? */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  // IPv6
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true; // link-local + ULA
  // IPv4-mapped IPv6 (::ffff:10.0.0.1)
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const ipv4 = mapped ? mapped[1]! : v;
  const m = ipv4.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 metadata
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

/**
 * Valida + resuelve una URL contra SSRF. Lanza ScrapeError si:
 *  - no es http/https o es inválida,
 *  - el host es localhost/loopback,
 *  - el host resuelve (DNS) a una IP privada/interna.
 * Devuelve la URL normalizada si pasa.
 */
export async function assertSafeUrl(rawUrl: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new ScrapeError('invalid_url', 'La URL no es válida.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new ScrapeError('invalid_url', 'Solo se permiten URLs http/https.');
  }
  const host = u.hostname.toLowerCase();

  // Bloqueo directo por nombre.
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0') {
    throw new ScrapeError('ssrf_blocked', 'No se permite acceder a recursos internos.');
  }
  // Si el host ya es una IP literal, valídala directo.
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host.replace(/^\[|\]$/g, ''))) {
      throw new ScrapeError('ssrf_blocked', 'No se permite acceder a IPs internas.');
    }
    return u.toString();
  }

  // Resolución DNS: rechaza si CUALQUIER IP resuelta es privada (anti rebind/trick).
  try {
    const results = await lookupAsync(host, { all: true });
    for (const r of results) {
      if (isPrivateIp(r.address)) {
        throw new ScrapeError('ssrf_blocked', 'El dominio resuelve a una IP interna; bloqueado.');
      }
    }
  } catch (err) {
    if (err instanceof ScrapeError) throw err;
    // Fallo de DNS: dejamos pasar y que la navegación falle limpiamente (no es
    // un caso SSRF; un dominio inexistente simplemente no carga).
  }
  return u.toString();
}

/**
 * Scrapea una URL. Lanza chromium headless, extrae datos y cierra SIEMPRE.
 * Aplica el guard SSRF antes de navegar.
 * @throws ScrapeError en URL inválida, SSRF o fallo de navegación.
 */
export async function scrapeUrl(rawUrl: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  const safeUrl = await assertSafeUrl(rawUrl);
  return renderAndExtract(safeUrl, opts);
}

/**
 * renderAndExtract — motor de render/extracción SIN guard SSRF.
 *
 * ⚠️ USO INTERNO Y DE TESTS ÚNICAMENTE. No exponer en endpoints: salta la
 * protección anti-SSRF. Existe para poder validar la extracción contra un
 * servidor local de prueba (127.0.0.1) sin desactivar el guard de producción.
 * En producción, todo pasa por scrapeUrl() (con guard).
 */
export async function renderAndExtract(safeUrl: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  let browser: Browser | null = null;
  try {
    try {
      browser = await chromium.launch({
        headless: true,
        executablePath: env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
    } catch (err) {
      throw new ScrapeError('launch_failed', `No se pudo iniciar el navegador: ${(err as Error).message}`);
    }

    const context = await browser.newContext({
      userAgent: 'NexusBot/2.0 (+https://nexus.j4smartsolutions.com)',
      // No seguir descargas; sólo páginas.
      acceptDownloads: false,
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    try {
      await page.goto(safeUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      if (opts.waitFor) {
        await page.waitForSelector(opts.waitFor, { timeout: NAV_TIMEOUT_MS }).catch(() => {});
      }
    } catch (err) {
      throw new ScrapeError('nav_failed', `No se pudo cargar la página: ${(err as Error).message}`);
    }

    const title = (await page.title().catch(() => '')) || '';
    // page.evaluate corre en el contexto del browser; usamos globalThis para no
    // depender de los lib.dom types en la compilación del backend (lib node).
    const text = (
      await page
        .evaluate(() => {
          const g = globalThis as { document?: { body?: { innerText?: string } } };
          return g.document?.body?.innerText ?? '';
        })
        .catch(() => '')
    ).slice(0, MAX_TEXT);

    let extracted: string | null = null;
    if (opts.selector) {
      extracted = await page
        .$eval(opts.selector, (el) => (el as { innerText?: string }).innerText?.trim() ?? '')
        .catch(() => null);
    }

    return { url: safeUrl, title: title.trim(), text: text.trim(), extracted };
  } finally {
    // Cierre garantizado del browser — nunca dejar chromium colgado.
    if (browser) {
      await browser.close().catch((e) => console.error('[scraper] error al cerrar browser:', (e as Error).message));
    }
  }
}
