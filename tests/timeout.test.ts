/**
 * Limit czasu żądań.
 *
 * Moduł istnieje z jednego powodu: `AbortSignal.timeout` nie ma w React Native,
 * a pod Node jest. Test samego helpera to połowa ochrony — druga połowa pilnuje,
 * żeby nikt nie wrócił do wywołania, które tu przechodzi, a na telefonie rzuca.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { timeoutSignal } from '../src/lib/timeout.ts';

describe('limit czasu żądania', () => {
  it('przerywa po upływie limitu', async () => {
    const { signal, clear } = timeoutSignal(10);

    await new Promise((resolve) => signal.addEventListener('abort', resolve));
    assert.equal(signal.aborted, true);
    clear();
  });

  it('przerywa razem z sygnałem wywołującego', () => {
    const outer = new AbortController();
    const { signal, clear } = timeoutSignal(60_000, outer.signal);

    outer.abort();
    assert.equal(signal.aborted, true);
    clear();
  });

  it('sygnał przerwany wcześniej przerywa od razu', () => {
    const outer = new AbortController();
    outer.abort();

    const { signal, clear } = timeoutSignal(60_000, outer.signal);
    assert.equal(signal.aborted, true);
    clear();
  });

  it('po wyczyszczeniu zegar już nie przerywa', async () => {
    const { signal, clear } = timeoutSignal(10);
    clear();

    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(signal.aborted, false);
  });
});

describe('kod aplikacji', () => {
  it('nie woła AbortSignal.timeout ani AbortSignal.any', () => {
    // Pod Node oba istnieją, więc żaden inny test tego nie złapie — a w React
    // Native wywołanie rzuca, zanim żądanie w ogóle wyjdzie.
    const offenders = ['app', 'src']
      .flatMap((dir) =>
        (readdirSync(dir, { recursive: true }) as string[])
          .filter((name) => /\.tsx?$/.test(name))
          .map((name) => join(dir, name)),
      )
      .filter((path) => /AbortSignal\.(timeout|any)\(/.test(readFileSync(path, 'utf8')));

    assert.deepEqual(offenders, []);
  });
});
