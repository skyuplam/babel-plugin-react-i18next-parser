# babel-plugin-react-i18next-parser
A babel plugin to extract i18n message from React components that use [react-i18next](https://github.com/i18next/react-i18next).

# Features
+ Support i18next `t` translation function features:
  + [Interpolation](https://www.i18next.com/translation-function/interpolation)
  + [Formatting](https://www.i18next.com/translation-function/formatting)
  + [Plurals](https://www.i18next.com/translation-function/plurals),
    e.g. `key_plural`, (`key_plural_0` is not supported)
  + [Context](https://www.i18next.com/translation-function/context),
    e.g. `key_context` or `key_context_plural`
+ Support [`I18n` Component(render prop)](https://react.i18next.com/components/i18n-render-prop)
+ Support [`Trans` Component](https://react.i18next.com/components/trans-component<Paste>)
+ Support [`translate` HOC](https://react.i18next.com/components/translate-hoc)
+ Support [`Interpolate` Component](https://react.i18next.com/components/interpolate)

# Installation
```sh
$ npm install -D babel-plugin-react-i18next-parser
```

# Usage
*This babel plugin only visits ES6 modules which `import` `react-i18next`.*

## Via `.babelrc`

### .babelrc

```json
{
  "plugins": [
    ["react-i18next-parser", {
      "defaultNamespace": "defaultNS",
      "output": "locales",
      "locales": ["en", "fr"]
    }]
  ]
}
```
### Options
+ `defaultNamespace`: `string`, `required`, the default namespace in your i18next options,
  default: `translation`
+ `output`: `string`, the output folder name. The folder will be created under the root of project directory,
  default: `locales`
+ `locales`: `array`, `required`, the output locale folders created under the `output` directory,
  default: `['en']`
+ `namespaceSeparator`, `string`, the symbol to separate the namespace and key,
  default: `':'`
+ `moduleSourceName`, `string`, the module source name to look for,
  default: `react-i18next`


# Inspirations
+ [babel-plugin-react-intl](https://github.com/yahoo/babel-plugin-react-intl)
+ [i18next-parser](https://github.com/i18next/i18next-parser)
