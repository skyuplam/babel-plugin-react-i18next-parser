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
      const output = `test/fixtures/${caseName}/${BASE_OPTIONS.output}`;
      const outputDir = path.join(process.cwd(), output);

      // Sync translation dir to virtual FS
      if (fs.existsSync(outputDir)) {
        // Load the existing translation to virtual FS
        fs.readdirSync(outputDir).forEach(lng => {
          // Sync translation directories
          const lngDir = path.join(outputDir, lng);
          mFs.mkdirpSync(lngDir);

          // Sync Files
          fs.readdirSync(lngDir).forEach(filename => {
            const filepath = path.join(lngDir, filename);
            const file = fs.readFileSync(filepath, 'UTF-8');
            mFs.writeFileSync(filepath, file);
          });
        });
      }

      // Transform
      transform(path.join(fixtureDir, 'actual.js'), { output });

      // Check the output
      expect(() => mFs.statSync(outputDir).isDirectory)
        .not.toThrow();

      mFs.readdirSync(outputDir).forEach(locale => {
        expect(BASE_OPTIONS.locales.indexOf(locale) !== -1).toBeTruthy();

        const localeDir = path.join(outputDir, locale);

        // Read file outputs and compare the values
        mFs.readdirSync(localeDir).forEach(file => {
          const messages = mFs.readFileSync(
            path.join(localeDir, file), 'UTF-8');
          const expectedFilePath = path.join(fixtureDir,
            `expected/${BASE_OPTIONS.output}/${locale}/${file}`);
          const expectedMessages = fs.readFileSync(expectedFilePath, 'UTF-8');

          expect(JSON.parse(messages))
            .toEqual(JSON.parse(expectedMessages));
        });
      });
    });
  });
});
