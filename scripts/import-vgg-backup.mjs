import { readFileSync } from 'node:fs';
import { readVggBackup } from './inspect-office-backup.mjs';
import { prepareVggImport } from './prepare-vgg-import.mjs';

try {
  const [backupPath, apiOrigin] = process.argv.slice(2);
  const endpoint = new URL('/internal/import-vgg', apiOrigin);
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.workers.dev') ||
      endpoint.username || endpoint.password) {
    throw new Error('Nhap URL HTTPS workers.dev cua backend Office.');
  }
  const input = JSON.parse(readFileSync(0, 'ascii'));
  const { snapshot } = readVggBackup(backupPath, Buffer.from(input.passphrase, 'base64'));
  const token = Buffer.from(input.token, 'base64');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token.toString('utf8')}`,
  };
  token.fill(0);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(prepareVggImport(snapshot)),
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => null);
  if (response.status !== 201) throw new Error(`Office import failed (${response.status}): ${result?.error ?? 'no result'}`);
  console.table({ Phong: 'VGG', ThanhVien: result.members, TaiKhoan: result.accounts, TinNhan: result.messages });
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Office import failed.');
  process.exitCode = 1;
}
