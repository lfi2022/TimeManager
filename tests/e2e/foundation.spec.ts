import { test, expect } from '@playwright/test';
test('React and API share the same production server', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('TempoPoint');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Moins de papier.',
  );
  await expect(page.getByRole('status')).toHaveText('Service disponible');
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({
    data: { status: 'ok', version: '0.1.0' },
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('deep links load React and navigate back home', async ({ page }) => {
  await page.goto('/une/page/profonde');
  await expect(
    page.getByRole('heading', { name: 'Page introuvable' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
  await expect(page.getByRole('status')).toHaveText('Service disponible');
});
test('API failure is visible', async ({ page }) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText(
    'Service momentanément indisponible',
  );
});
