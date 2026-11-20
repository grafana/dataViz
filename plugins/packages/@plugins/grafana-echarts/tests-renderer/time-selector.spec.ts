import { test, expect } from '@playwright/test';
import { draw, fixtureSpec, readMessages } from './harness';

for (const theme of ['dark', 'light']) {
  for (const width of [375, 1280]) {
    test(`standalone time selector at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await draw(page, { ...fixtureSpec('prometheus-line'), theme }, { size: { width, height: 600 } });
      const app = page.frameLocator('#app');
      const trigger = app.getByTestId('data-testid TimePicker Open Button');
      await expect(trigger).toBeVisible();
      await expect(app.getByRole('button', { name: 'Move time range backwards' })).toHaveCount(0);
      await expect(app.getByRole('button', { name: 'Move time range forwards' })).toHaveCount(0);
      await expect(app.getByRole('button', { name: 'Zoom out time range' })).toHaveCount(0);
      await trigger.click();
      await expect(app.getByRole('dialog', { name: 'Time range picker' })).toBeVisible();
      await page.screenshot({ path: `/tmp/renderer-time-selector-${width}-${theme}.png` });
      const search = app.getByRole('textbox', { name: 'Search quick ranges' });
      if (width < 1024) {
        await search.fill('3h');
        await search.press('Enter');
      } else {
        await app.getByText('Last 3 hours', { exact: true }).click();
      }
      await expect.poll(async () => (await readMessages(page)).filter((m) => m.type === 'refresh').length).toBe(1);
      expect((await readMessages(page)).filter((m) => m.type === 'error')).toEqual([]);
    });
  }
}
