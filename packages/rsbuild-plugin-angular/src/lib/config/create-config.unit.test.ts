import { createConfig } from './create-config';
import { vi } from 'vitest';
import { osAgnosticPath } from 'testing-utils';
import path from 'node:path';

describe('createConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a CSR config', () => {
    const config = createConfig({
      root: __dirname,
      inlineStylesExtension: 'scss',
      tsconfigPath: './tsconfig.app.json',
    });

    expect(
      JSON.stringify(
        {
          ...config,
          root: osAgnosticPath(path.relative(process.cwd(), config.root ?? '')),
        },
        null,
        2
      )
    ).toMatchFileSnapshot('__snapshots__/csr-config.json');
  });

  it('should create a SSR config', () => {
    vi.mock('node:fs', async (importOriginal) => {
      return {
        ...(await importOriginal<typeof import('node:fs')>()),
        existsSync: () => true,
      };
    });
    const config = createConfig({
      root: __dirname,
      server: './src/main.server.ts',
      ssrEntry: './src/server.ts',
      inlineStylesExtension: 'scss',
      tsconfigPath: './tsconfig.app.json',
    });

    expect(
      JSON.stringify(
        {
          ...config,
          root: osAgnosticPath(path.relative(process.cwd(), config.root ?? '')),
        },
        null,
        2
      )
    ).toMatchFileSnapshot('__snapshots__/ssr-config.json');
  });
});
