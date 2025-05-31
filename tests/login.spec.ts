import { test } from '@playwright/test';

test('Login example', async ({ page }) => {
    await page.goto('https://the-internet.herokuapp.com/login');
    await page.locator("//input[@id='username']").fill("tomsmith");
    await page.locator("//input[@id='password']").fill("SuperSecretPassword!");
    await page.locator("//button[@type='submit']").click();
});

