import { healthResponseSchema } from '@lfinfo/shared';
export async function fetchHealth() {
  const response = await fetch('/api/health', {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok)
    throw new Error('Le service est momentanément indisponible.');
  return healthResponseSchema.parse(await response.json()).data;
}
