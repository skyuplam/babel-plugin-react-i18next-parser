import * as p from 'path';
import defaultFs from 'fs';
import _ from 'lodash';

import printMessage from './printMessage';

const KEY_PROP = 'i18nKey';
const DEFAULT_NS_SEPERATOR = ':';
const DEFAULT_NS_KEY = 'defaultNS';
const REACT_TRANSLATE_FUNC_NAME = 'translate';
const TRANSLATE_FUNC_NAME = 't';
const DESCRIPTOR_PROPS = new Set([KEY_PROP]);
const EXTRACTED = Symbol('ReactI18nextExtracted');
const MESSAGES = Symbol('ReactI18nextMessages');
const NAMESPACES = Symbol('ReactI18nextNamespaces');
const COMPONENT_NAMES = [
  'Trans',
  'Interpolate',
];
const FUNCTION_NAMES = [
  REACT_TRANSLATE_FUNC_NAME,
  TRANSLATE_FUNC_NAME,
];

export default function ({ types: t }) {
  function evaluatePath(path) {
    const evaluated = path.evaluate();
    if (evaluated.confident) {
      return evaluated.value;
    }
    throw path.buildCodeFrameError(
      '[React i18next] Messages must be statically evaluate-able for extraction.');
  }

  function getMessageDescriptorKey(path) {
    if (path.isIdentifier() || path.isJSXIdentifier()) {
      return path.node.name;
    }

    return evaluatePath(path);
  }

  function getChildren(path) {
    return path.container.children;
  }

  function createMessageDescriptor(propPaths) {
    return propPaths.reduce((hash, [keyPath, valuePath]) => {
      const key = getMessageDescriptorKey(keyPath);

      if (DESCRIPTOR_PROPS.has(key)) {
        hash[key] = valuePath;
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

  function getMessageDescriptorValue(path) {
    if (path.isJSXExpressionContainer()) {
      path = path.get('expression');
    }

    // Always trim the Message Descriptor values.
    const descriptorValue = evaluatePath(path);

    if (typeof descriptorValue === 'string') {
      return descriptorValue.trim();
    }

    return descriptorValue;
  }

  function evaluateMessageDescriptor(descriptor, children) {
    Object.keys(descriptor).forEach(key => {
      const valuePath = descriptor[key];
      descriptor[key] = getMessageDescriptorValue(valuePath);
    });

    return { ...descriptor, defaultValue: printMessage(children) };
  }

  function getRelativeLoc(path, { file }) {
    return {
      file: p.relative(process.cwd(), file.opts.filename),
      ...path.node.loc,
    };
  }

  function storeMessage(descriptor, path, { file }) {
    const messages = file.get(MESSAGES);
    const id = descriptor[KEY_PROP] || descriptor.defaultValue;

    if (messages.has(id)) {
      const msg = messages.get(id);
      if (msg.defaultValue !== descriptor.defaultValue) {
        throw path.buildCodeFrameError(
          `[React i18next] Message with same ID but different value:\n ${msg}\n ${descriptor}`);
      }
    }

    messages.set(id,
      { ...descriptor, loc: getRelativeLoc(path, { file }) });
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

  function decodeID(id, file, namespaceSeperator = DEFAULT_NS_SEPERATOR) {
    const namespaces = file.get(NAMESPACES);
    const seperator = namespaceSeperator;
    const defaultNamespace = namespaces.get(DEFAULT_NS_KEY).namespace;

    if (!id) {
      return { namespace: defaultNamespace };
    }

    const parts = id.split(seperator);

    if (parts.length <= 1) {
      return { namespace: defaultNamespace, key: id };
    }

    return {
      namespace: namespaces.get(parts[0]).namespace,
      key: parts.slice(1).join(seperator),
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
          const descriptor = createMessageDescriptor(
            attributes.map(attr => [attr.get('name'), attr.get('value')]));
          const evaluatedDescriptor = evaluateMessageDescriptor(descriptor,
            getChildren(path));

          storeMessage(evaluatedDescriptor, path, state);
        }
      },
      CallExpression(path, state) {
        const { opts } = state;
        const moduleSourceName = getModuleSourceName(opts);
        const callee = path.get('callee');

        // react-i18next Module import functions, e.g. translate
        if (referencesImport(callee, moduleSourceName, FUNCTION_NAMES)) {
          const argumentPaths = path.get('arguments');
          const calleeName = getCalleeName(path);

          if (calleeName === REACT_TRANSLATE_FUNC_NAME) {
            if (!argumentPaths.length) {
              storeNamespace(DEFAULT_NS_KEY, opts.defaultNamespace, path, state);
            } else {
              argumentPaths.forEach(a => {
                switch (a.type) {
                  case 'FunctionExpression': {
                    throw path.buildCodeFrameError(
                      '[React i18next] Function is not supported in translate HOC');
                  }
                  case 'ArrayExpression': {
                    const nss = evaluatePath(a);
                    nss.forEach((ns, idx) => {
                      storeNamespace(idx ? ns : DEFAULT_NS_KEY,
                        ns, path, state);
                    });
                    break;
                  }
                  default: {
                    const ns = evaluatePath(a);
                    storeNamespace(DEFAULT_NS_KEY,
                      ns, path, state);
                    break;
                  }
                }
              });
            }
          }
        }

        const isTranslationFunction = (getCalleeName(path) === TRANSLATE_FUNC_NAME);
        if (isTranslationFunction) {
          const argPaths = path.get('arguments');
          const descriptor = argPaths.reduce((hash, arg, idx) => {
            switch (idx) {
              // Key argument
              case 0: {
                switch (arg.type) {
                  case 'StringLiteral': {
                    return { ...hash, [KEY_PROP]: evaluatePath(arg) };
                  }
                  default:
                    return hash;
                }
              }
              // Options argument
              case 1: {
                switch (arg.type) {
                  case 'StringLiteral': {
                    return { ...hash, defaultValue: evaluatePath(arg) };
                  }
                  default: {
                    return hash;
                  }
                }
              }
              default: {
                return hash;
              }
            }
          }, {});
          storeMessage({
            ...descriptor,
            defaultValue: descriptor.defaultValue || '',
          }, path, state);
        }
      },
    },
    post(file) {
      // Get the plugin Options
      const { opts: { locales, output, fs = defaultFs, namespaceSeperator } } = this;

      locales.forEach(locale => {
        const dir = p.join(process.cwd(), output, locale);
        fs.mkdirpSync(dir);
      });

      const messages = [...file.get(MESSAGES).values()].reduce((hash, descriptor) => {
        const { namespace, key } = decodeID(descriptor[KEY_PROP],
          file, namespaceSeperator);
        if (key) {
          _.set(hash, `${namespace}.${key}`, descriptor.defaultValue);
        } else {
          if (!hash[namespace]) {
            hash[namespace] = {};
          }
          hash[namespace][descriptor.defaultValue] = descriptor.defaultValue;
        }
        return hash;
      }, {});

      locales.forEach(locale => {
        _.forEach(messages, (value, namespace) => {
          const filename = p.join(process.cwd(), output, locale, `${namespace}.json`);
          const fileContent = JSON.stringify(value, null, 2);
          fs.writeFileSync(filename, fileContent);
        });
      });
    },
  };
}
