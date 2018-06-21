function parserI18next(messages) {
  if (Array.isArray(messages)) {
    return messages.map(child => {
      switch (child.type) {
        case 'JSXText': {
          return {
            type: 'text',
            content: child.value.replace(
              /^(?:\s*(\n|\r)\s*)?(.*)(?:\s*(\n|\r)\s*)?$/, '$2'),
          };
        }
        case 'JSXElement': {
          return {
            type: 'tag',
            children: parserI18next(child.children),
          };
        }
        case 'JSXExpressionContainer': {
          switch (child.expression.type) {
            case 'JSXEmptyExpresssion':
              return { type: 'text', content: '' };
            case 'ObjectExpression': {
              // i18next-react only accepts two props, any random single prop,
              // and a format prop for our purposes, format prop is always ignored
              const props = child.expression.properties
                .filter(p => p.key.name !== 'format')
                .map(p => p.key.name);
              return {
                type: 'js',
                content: props.length > 0 ? `{{${props[0]}}}` : '',
              };
            }
            default: return { type: 'unknown', content: child };
          }
        }
        default: return { type: 'unknown', content: child };
      }
    }).filter(child => child.type !== 'text' || child.content);
  }
  return [];
}

function formatMessage(messages) {
  return messages.map((child, index) => {
    switch (child.type) {
      case 'text': return child.content;
      case 'js': return `<${index}>${child.content}</${index}>`;
      case 'tag': return `<${index}>${formatMessage(child.children)}</${index}>`;
      default: return '';
    }
  });
}

function printMessage(children) {
  return formatMessage(children).join('');
}

export default function (message) {
  return printMessage(parserI18next(message));
}

