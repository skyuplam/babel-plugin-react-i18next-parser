import * as p from 'path';
import defaultFs from 'fs';
import mkdirp from 'mkdirp';
import _ from 'lodash';

import printMessage from './printMessage';

const KEY_PROP = 'i18nKey';
const PLURAL_PROP = 'count';
const CONTEXT_PROP = 'context';
const DEFAULT_VALUE_PROP = 'defaultValue';
const NS_PROP = 'ns';
const EVALUABLE_PROPS = new Set([
  KEY_PROP,
  CONTEXT_PROP,
  DEFAULT_VALUE_PROP,
]);
const PLURAL_KEY_SUFFIX = 'plural';
const DEFAULT_NS_KEY = 'defaultNS';
const REACT_TRANSLATE_HOC_FUNC = 'translate'; // `translate` HOC
const TRANSLATE_FUNC_NAME = 't'; // i18next `t` function
const FALLBAK_KEY = 'fallback';
const EXTRACTED = Symbol('ReactI18nextExtracted');
const MESSAGES = Symbol('ReactI18nextMessages');
const NAMESPACES = Symbol('ReactI18nextNamespaces');
const NAMESPACE_COMPONENT = 'I18n';
const COMPONENT_NAMES = [
  'Trans',
  'Interpolate',
  NAMESPACE_COMPONENT,
];
const FUNCTION_NAMES = [
  REACT_TRANSLATE_HOC_FUNC,
  TRANSLATE_FUNC_NAME,
];

// Default Options
const defaultOptions = {
  output: 'locales',
  defaultNamespace: 'translation',
  namespaceSeparator: ':',
  moduleSourceName: 'react-i18next',
  locales: ['en'],
};


// eslint-disable-next-line no-unused-vars
export default function ({ types: t }) {
  function evaluatePath(path) {
    const evaluated = path.evaluate();
    if (evaluated.confident) {
      return evaluated.value;
    }
    throw path.buildCodeFrameError(
      '[React i18next] Messages must be statically evaluate-able for extraction.',
    );
  }

  function getPropKey(path) {
    if (path.isIdentifier() || path.isJSXIdentifier()) {
      return path.node.name;
    }

    return evaluatePath(path);
  }

  function getPropValue(path) {
    const propPath = path.isJSXExpressionContainer()
      ? path.get('expression') : path;

    // Always trim the Message Descriptor values.
    const descriptorValue = evaluatePath(propPath);

    if (typeof descriptorValue === 'string') {
      return descriptorValue.trim();
    }

    return descriptorValue;
  }

  function getChildren(path) {
    return path.container.children;
  }

  function createMessageDescriptor(propPaths) {
    return propPaths.reduce((hash, [keyPath, valuePath]) => {
      const key = getPropKey(keyPath);

      if (EVALUABLE_PROPS.has(key)) {
        return { ...hash, [key]: getPropValue(valuePath) };
      }
      if (key === PLURAL_PROP) {
        return { ...hash, plural: true };
      }

      return hash;
    }, {});
  }

  function getModuleSourceName(opts) {
    return opts.moduleSourceName || 'react-i18next';
  }

  function getCalleeName(path) {
    return path.node.callee.name;
  }

  function referencesImport(path, mod, importedNames) {
    if (!(path.isIdentifier() || path.isJSXIdentifier())) {
      return false;
    }

    return importedNames.some(name => path.referencesImport(mod, name));
  }

  function tagAsExtracted(path) {
    path.node[EXTRACTED] = true;
  }

  function wasExtracted(path) {
    return Boolean(path.node[EXTRACTED]);
  }

  function evaluateTranslateKeyArg(keyPath, hash = {}) {
    switch (keyPath.type) {
      case 'BinaryExpression':
      case 'StringLiteral': {
        return { ...hash, [KEY_PROP]: evaluatePath(keyPath) };
      }
      case 'ArrayExpression': {
        const evaluated = evaluatePath(keyPath);
        return evaluated.reduce((ks, k, idx) => ({
          ...ks,
          [idx ? `${FALLBAK_KEY}-${idx}` : KEY_PROP]: k,
        }), {});
      }
      default:
        return hash;
    }
  }

  function evaluateTranslationOptsArg(optPath, hash = {}) {
    switch (optPath.type) {
      case 'StringLiteral': {
        return { ...hash, defaultValue: evaluatePath(optPath) };
      }
      case 'ObjectExpression': {
        const properties = optPath.get('properties');
        const descriptor = createMessageDescriptor(
          properties.map(prop => [prop.get('key'), prop.get('value')]),
        );
        return { ...hash, ...descriptor };
      }
      default: {
        return hash;
      }
    }
  }

  function evaluateTranslationContextArg(contextPath, hash = {}) {
    return { ...hash, context: evaluatePath(contextPath) };
  }

  function evaluateNSProps(propPaths) {
    return propPaths.reduce((props, propPath) => {
      switch (propPath.type) {
        case 'FunctionExpression': {
          throw propPath.buildCodeFrameError(
            '[React i18next] Function prop is not supported.',
          );
        }
        case 'ArrayExpression': {
          return [...props, ...evaluatePath(propPath)];
        }
        case 'BinaryExpression':
        case 'StringLiteral': {
          return [...props, evaluatePath(propPath)];
        }
        default: {
          return props;
        }
      }
    }, []);
  }

  function getMessageKeyValuePairs(descriptor) {
    const { context, plural, defaultValue = '' } = descriptor;
    const baseKey = descriptor[KEY_PROP] || defaultValue;
    const fallbackKeys = _.keys(descriptor)
      .filter(k => k.indexOf(FALLBAK_KEY) !== -1)
      .map(k => descriptor[k]);
    const keys = new Set([
      baseKey,
      [baseKey, context].filter(k => k).join('_'),
      [baseKey, context, plural ? PLURAL_KEY_SUFFIX : '']
        .filter(k => k).join('_'),
    ]);

    return [...keys, ...fallbackKeys]
      .map(key => ({ key, defaultValue }));
  }

  function getRelativeLoc(path, { file }) {
    return {
      file: p.relative(process.cwd(), file.opts.filename),
      ...path.node.loc,
    };
  }

  function storeMessage(descriptor, path, { file }) {
    const messages = file.get(MESSAGES);
    const kvs = getMessageKeyValuePairs(descriptor);

    _.forEach(kvs, kv => {
      messages.set(kv.key, { ...kv, loc: getRelativeLoc(path, { file }) });
    });
  }

  function storeNamespace(id, namespace, path, state) {
    const { file } = state;
    const namespaces = file.get(NAMESPACES);
    namespaces.set(id, {
      id,
      namespace,
      loc: getRelativeLoc(path, state),
    });
  }

  function storeNamespaces(namespaces, path, state) {
    const { opts } = state;
    if (!namespaces.length) {
      storeNamespace(DEFAULT_NS_KEY,
        opts.defaultNamespace || defaultOptions.defaultNamespace, path, state);
    } else {
      namespaces.forEach((ns, idx) => {
        storeNamespace(idx ? ns : DEFAULT_NS_KEY, ns, path, state);
      });
    }
  }

  function decodeID(id, file,
    namespaceSeparator = defaultOptions.namespaceSeparator) {
    const namespaces = file.get(NAMESPACES);
    const separator = namespaceSeparator;
    const defaultNamespace = namespaces.get(DEFAULT_NS_KEY).namespace;

    if (!id) {
      return { namespace: defaultNamespace };
    }

    const parts = id.split(separator);

    if (parts.length <= 1) {
      return { namespace: defaultNamespace, key: id };
    }

    return {
      namespace: namespaces.get(parts[0]).namespace,
      key: parts.slice(1).join(separator),
    };
  }

  return {
    pre(file) {
      if (!file.has(MESSAGES)) {
        file.set(MESSAGES, new Map());
      }
      if (!file.has(NAMESPACES)) {
        file.set(NAMESPACES, new Map());
      }
    },
    visitor: {
      JSXOpeningElement(path, state) {
        if (wasExtracted(path)) return;

        const { opts } = state;
        const moduleSourceName = getModuleSourceName(opts);
        const name = path.get('name');

        if (referencesImport(name, moduleSourceName, COMPONENT_NAMES)) {
          const attributes = path.get('attributes')
            .filter(attr => attr.isJSXAttribute());
          if (referencesImport(name, moduleSourceName, [NAMESPACE_COMPONENT])) {
            const propPaths = attributes
              .filter(attr => getPropKey(attr.get('name')) === NS_PROP)
              .map(attr => {
                const attrPath = attr.get('value');
                return attrPath.isJSXExpressionContainer() ?
                  attrPath.get('expression') : attrPath;
              });
            const namespaces = evaluateNSProps(propPaths);
            storeNamespaces(namespaces, path, state);
          } else {
            const descriptor = createMessageDescriptor(
              attributes.map(attr => [attr.get('name'), attr.get('value')]));

            const defaultValue = printMessage(getChildren(path));

            storeMessage({ ...descriptor, defaultValue }, path, state);
          }

          // Tag the AST node so we don't try to extract it twice.
          tagAsExtracted(path);
        }
      },
      CallExpression(path, state) {
        if (wasExtracted(path)) return;

        const { opts } = state;
        const moduleSourceName = getModuleSourceName(opts);
        const callee = path.get('callee');

        // react-i18next Module import functions, e.g. translate
        if (referencesImport(callee, moduleSourceName, FUNCTION_NAMES)) {
          const argumentPaths = path.get('arguments');
          const calleeName = getCalleeName(path);

          if (calleeName === REACT_TRANSLATE_HOC_FUNC) {
            const namespaces = evaluateNSProps(argumentPaths);
            storeNamespaces(namespaces, path, state);
          }

          // Tag the AST node so we don't try to extract it twice.
          tagAsExtracted(path);
        }

        const isTranslationFunction = (
          getCalleeName(path) === TRANSLATE_FUNC_NAME);
        if (isTranslationFunction) {
          // Evaluate all arguments called by the function
          const argPaths = path.get('arguments');
          const descriptor = argPaths.reduce((hash, arg, idx) => {
            switch (idx) {
              // Key argument
              case 0: {
                return evaluateTranslateKeyArg(arg, hash);
              }
              // Options argument
              case 1: {
                return evaluateTranslationOptsArg(arg, hash);
              }
              case 2: {
                return evaluateTranslationContextArg(arg, hash);
              }
              default: {
                return hash;
              }
            }
          }, {});

          storeMessage({ ...descriptor, defaultValue: descriptor.defaultValue },
            path, state);

          // Tag the AST node so we don't try to extract it twice.
          tagAsExtracted(path);
        }
      },
    },
    post(file) {
      // Get the plugin Options
      const {
        opts: {
          locales = defaultOptions.locales,
          output = defaultOptions.output,
          fs = defaultFs,
          namespaceSeperator = defaultOptions.namespaceSeperator,
        },
      } = this;

      // Restructure messages with namespaces
      const messages = [...file.get(MESSAGES).values()]
        .reduce((hash, descriptor) => {
          // Get namespace and key
          const { namespace, key } = decodeID(descriptor.key,
            file, namespaceSeperator);

          // create message hash
          const msg = key ? _.set({}, key, descriptor.defaultValue) :
            { [descriptor.defaultValue]: descriptor.defaultValue };

          return _.merge({}, hash, { [namespace]: msg });
        }, {});

      // Write files into each locale predefined in options
      locales.forEach(locale => {
        const dir = p.join(process.cwd(), output, locale);
        // Create the locale dir
        mkdirp.sync(dir, { fs });

        _.forEach(messages, (value, namespace) => {
          // Use namespace as filename
          const filename = p.join(dir, `${namespace}.json`);

          // Merge the old translations
          // Old translation always take priority
          const oldContent = fs.existsSync(filename) ?
            JSON.parse(fs.readFileSync(filename, 'UTF-8')) : {};
          const newContent = _.merge({}, value, oldContent);

          // Format JSON output with 2 spaces
          const fileContent = JSON.stringify(newContent, null, 2);
          fs.writeFileSync(filename, fileContent);
        });
      });
    },
  };
}
