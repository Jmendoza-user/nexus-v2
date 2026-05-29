/**
 * seedSkillsCatalog — siembra (idempotente) el catálogo GLOBAL de skills
 * disponibles para instalar. Estas son DEFINICIONES (.md) que el agente
 * "instala" en el env del usuario (env/skills/<key>/SKILL.md).
 *
 * NO está scoped por tenant: es catálogo compartido (como tier_policies).
 * Se usa upsert por `key` para poder re-sembrar sin duplicar.
 */
import { db } from './index.js';
import { skillsCatalog } from './schema.js';

export interface CatalogSeed {
  key: string;
  name: string;
  description: string;
  capabilities: string[];
  requiresMcp: string[];
  sourceType: 'local' | 'github' | 'url';
  sourceRef: string | null;
}

/**
 * Catálogo base. `local` significa que el SKILL.md se GENERA desde esta misma
 * definición (no se descarga de ningún lado) — apto para el runtime actual.
 */
export const SKILLS_CATALOG: CatalogSeed[] = [
  {
    key: 'buscador-web',
    name: 'Buscador web',
    description:
      'Busca información actualizada en la web y resume los resultados relevantes para responder con datos frescos.',
    capabilities: ['web.search', 'web.fetch', 'resumen'],
    requiresMcp: ['playwright-mcp'],
    sourceType: 'local',
    sourceRef: null,
  },
  {
    key: 'lector-pdf',
    name: 'Lector de PDF',
    description:
      'Extrae y entiende el texto de archivos PDF (facturas, contratos, informes) para que el agente pueda razonar sobre ellos.',
    capabilities: ['pdf.extract', 'pdf.ocr', 'documento.analizar'],
    requiresMcp: [],
    sourceType: 'local',
    sourceRef: null,
  },
  {
    key: 'resumidor',
    name: 'Resumidor',
    description:
      'Condensa textos largos, hilos de conversación y notas del vault en resúmenes claros y accionables.',
    capabilities: ['texto.resumir', 'texto.puntos-clave'],
    requiresMcp: [],
    sourceType: 'local',
    sourceRef: null,
  },
  {
    key: 'agenda-google',
    name: 'Agenda Google',
    description:
      'Crea, consulta y mueve eventos de Google Calendar para gestionar tu agenda por voz o texto.',
    capabilities: ['calendar.read', 'calendar.write', 'agenda.disponibilidad'],
    requiresMcp: ['gcal-mcp'],
    sourceType: 'local',
    sourceRef: null,
  },
  {
    key: 'finanzas-gmail',
    name: 'Finanzas Gmail',
    description:
      'Detecta movimientos bancarios y comprobantes en Gmail y arma borradores de transacciones para tu control financiero.',
    capabilities: ['gmail.read', 'finanzas.clasificar', 'borrador.transaccion'],
    requiresMcp: ['gmail-mcp'],
    sourceType: 'local',
    sourceRef: null,
  },
  {
    key: 'generador-imagenes',
    name: 'Generador de imágenes',
    description:
      'Genera imágenes y banners a partir de descripciones en lenguaje natural para tus publicaciones y bocetos.',
    capabilities: ['imagen.generar', 'imagen.variar'],
    requiresMcp: ['imagegen-worker'],
    sourceType: 'local',
    sourceRef: null,
  },
  {
    key: 'rag-vault',
    name: 'RAG Vault',
    description:
      'Búsqueda semántica sobre tus notas del segundo cerebro con citas a las fuentes originales.',
    capabilities: ['vault.rag', 'embeddings', 'citas'],
    requiresMcp: ['pgvector'],
    sourceType: 'local',
    sourceRef: null,
  },
  {
    key: 'ocr-tirillas',
    name: 'OCR de tirillas',
    description:
      'Lee facturas, recibos y tirillas a partir de una foto y extrae montos, fechas y comercios.',
    capabilities: ['ocr.imagen', 'finanzas.extraer'],
    requiresMcp: ['ocr-worker'],
    sourceType: 'local',
    sourceRef: null,
  },
];

export async function seedSkillsCatalog(): Promise<void> {
  for (const s of SKILLS_CATALOG) {
    await db
      .insert(skillsCatalog)
      .values({
        key: s.key,
        name: s.name,
        description: s.description,
        capabilities: s.capabilities,
        requiresMcp: s.requiresMcp,
        sourceType: s.sourceType,
        sourceRef: s.sourceRef,
      })
      .onConflictDoUpdate({
        target: skillsCatalog.key,
        set: {
          name: s.name,
          description: s.description,
          capabilities: s.capabilities,
          requiresMcp: s.requiresMcp,
          sourceType: s.sourceType,
          sourceRef: s.sourceRef,
        },
      });
  }
}

// Permite sembrar standalone: `tsx src/db/seedSkillsCatalog.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { pool } = await import('./index.js');
  await seedSkillsCatalog();
  // eslint-disable-next-line no-console
  console.log(`[seedSkillsCatalog] ${SKILLS_CATALOG.length} skills sembradas.`);
  await pool.end();
}
