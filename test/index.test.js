import * as path from 'path';
import * as fs from 'fs';
import { transformFileSync } from '@babel/core';
import MemFs from 'memory-fs';
import plugin from '../src/index';


const fixturesDir = path.join(__dirname, 'fixtures');
const mFs = new MemFs();

const BASE_OPTIONS = {
  output: 'locales',
  locales: ['en', 'fr'],
  fs: mFs,
  namespaceSeperator: ':',
  defaultNamespace: 'react',
};

function transform(filePath, options = {}) {
  return transformFileSync(filePath, {
    plugins: [[plugin, { ...BASE_OPTIONS, ...options }]],
  }).code;
}

const skipCases = [
  '.babelrc',
  '.DS_Store',
];

describe('emit assets for: ', () => {
  fs.readdirSync(fixturesDir).forEach(caseName => {
    if (skipCases.indexOf(caseName) >= 0) {
      return;
    }

    it(`output match: ${caseName}`, () => {
      const fixtureDir = path.join(fixturesDir, caseName);

      // Transform
      transform(path.join(fixtureDir, 'actual.js'), {
        output: `${caseName}/${BASE_OPTIONS.output}` });

      // Check the output
      const outputDir = path.join(process.cwd(), caseName, BASE_OPTIONS.output);
      expect(() => mFs.statSync(outputDir).isDirectory)
        .not.toThrow();

      mFs.readdirSync(outputDir).forEach(locale => {
        expect(BASE_OPTIONS.locales.indexOf(locale) !== -1).toBeTruthy();

        // Read file outputs and compare the values
        const messages = mFs.readFileSync(
          path.join(outputDir, `${locale}/react.json`), 'UTF-8');
        const expectedMessages = fs.readFileSync(
          path.join(fixtureDir,
            `expected/${BASE_OPTIONS.output}/${locale}/react.json`), 'UTF-8');

        expect(JSON.parse(messages)).toEqual(JSON.parse(expectedMessages));
      });
    });
  });
});
