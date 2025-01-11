/**
 * @license
 * The MIT License (MIT)
 *
 * Copyright (c) 2022 Brandon Roberts
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { dirname, resolve } from 'node:path';
import {
  ArrayLiteralExpression,
  Project,
  PropertyAssignment,
  SyntaxKind,
} from 'ts-morph';
import { normalize } from 'path';

/**
 * Represents a resolved URL where the left part is the original file name,
 * and the right part is the fully resolved path ending in that file name.
 *
 * For example, if T is `'button.ts'`, the resolved URL becomes:
 * `button.ts|path/to/button.ts`
 *
 * @template T - The original file name (e.g. `'button.ts'`).
 * @example
 * ```ts
 * type ExampleUrl = ResolvedUrl<'button.ts'>;
 * // Evaluates to: 'button.ts|path/to/button.ts'
 * ```
 */
type ResolvedUrl<T extends string = string> = `${T}|${string}${T}`;

interface StyleUrlsCacheEntry {
  matchedStyleUrls: string[];
  styleUrls: ResolvedUrl[];
}

/**
 * Resolves the style URLs from the component code.
 * The style URLs are resolved by reading the `styleUrls` and `styleUrl` properties
 * from the component code.
 * The normalized style URLs are cached to avoid normalizing them multiple times.
 * The normalized style URLs are returned in the format: `styleUrl|resolvedPath`.
 */
export class StyleUrlsResolver {
  // These resolvers may be called multiple times during the same
  // compilation for the same files. Caching is required because these
  // resolvers use synchronous system calls to the filesystem, which can
  // degrade performance when running compilations for multiple files.
  private readonly styleUrlsCache = new Map<string, StyleUrlsCacheEntry>();

  resolve(code: string, id: string): ResolvedUrl[] {
    // Given the code is the following:
    // @Component({
    //   styleUrls: [
    //     './app.component.scss'
    //   ]
    // })
    // The `matchedStyleUrls` would result in: `styleUrls: [\n    './app.component.scss'\n  ]`.
    const matchedStyleUrls = getStyleUrls(code);
    const entry = this.styleUrlsCache.get(id);
    // We're using `matchedStyleUrls` as a key because the code may be changing continuously,
    // resulting in the resolver being called multiple times. While the code changes, the
    // `styleUrls` may remain constant, which means we should always return the previously
    // resolved style URLs.
    // As the matchedStyleUrls value is an array of strings we have to compare the stringified version of the values.
    if (
      entry &&
      entry.matchedStyleUrls.join(',') === matchedStyleUrls.join(',')
    ) {
      return entry.styleUrls;
    }

    const normalizedStyleUrls = matchedStyleUrls.map((styleUrlPath) => {
      return `${styleUrlPath}|${normalize(
        resolve(dirname(id), styleUrlPath)
      )}` satisfies ResolvedUrl<typeof styleUrlPath>;
    });

    this.styleUrlsCache.set(id, {
      styleUrls: normalizedStyleUrls,
      matchedStyleUrls,
    });
    return normalizedStyleUrls;
  }
}

/**
 * Get the text value of a property by name and remove any quotes.
 * @param name
 * @param properties
 */
export function getTextByProperty(
  name: string,
  properties: PropertyAssignment[]
) {
  return properties
    .filter((property) => property.getName() === name)
    .map((property) =>
      property.getInitializer()?.getText().replace(/['"`]/g, '')
    )
    .filter((url): url is string => url !== undefined);
}

/**
 * Get the style URLs from the component code. ('styleUrl' as well as 'styleUrls')
 * @param code
 */
export function getStyleUrls(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('cmp.ts', code);
  const properties = sourceFile.getDescendantsOfKind(
    SyntaxKind.PropertyAssignment
  );
  const styleUrl = getTextByProperty('styleUrl', properties);
  const styleUrls = properties
    .filter((property) => property.getName() === 'styleUrls')
    .map((property) => property.getInitializer() as ArrayLiteralExpression)
    .flatMap((array) =>
      array.getElements().map((el) => el.getText().replace(/['"`]/g, ''))
    );

  return [...styleUrls, ...styleUrl];
}

export function getTemplateUrls(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('cmp.ts', code);
  const properties = sourceFile.getDescendantsOfKind(
    SyntaxKind.PropertyAssignment
  );
  return getTextByProperty('templateUrl', properties);
}

interface TemplateUrlsCacheEntry {
  code: string;
  templateUrlPaths: string[];
}

export class TemplateUrlsResolver {
  private readonly templateUrlsCache = new Map<
    string,
    TemplateUrlsCacheEntry
  >();

  resolve(code: string, id: string): string[] {
    const entry = this.templateUrlsCache.get(id);
    if (entry?.code === code) {
      return entry.templateUrlPaths;
    }

    const templateUrlPaths = getTemplateUrls(code).map(
      (url) =>
        `${url}|${normalize(resolve(dirname(id), url).replace(/\\/g, '/'))}`
    );

    this.templateUrlsCache.set(id, { code, templateUrlPaths });
    return templateUrlPaths;
  }
}
