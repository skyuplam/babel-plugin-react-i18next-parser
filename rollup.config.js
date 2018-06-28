import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';


export default {
  input: 'src/index.js',
  output: {
    file: 'dist/babel-plugin-react-i18next-parser.cjs.js',
    format: 'cjs',
  },
  plugins: [
    resolve(),
    commonjs(),
    babel({
      exclude: 'node_modules/**',
    }),
  ],
  external: ['fs', 'path'],
};
