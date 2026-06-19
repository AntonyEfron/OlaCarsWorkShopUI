import React from 'react';
import { useTranslation } from 'react-i18next';

export const AutoTranslate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();

  const translateNode = (node: React.ReactNode): React.ReactNode => {
    if (node === null || node === undefined) return node;

    // 1. If it's a string, translate it
    if (typeof node === 'string') {
      const trimmed = node.trim();
      if (!trimmed) return node;

      // Skip translating if it is purely numeric, dates, symbols, or code-like patterns
      if (/^[0-9\s$-.,+:/()!%?*#]*$/.test(trimmed)) return node;

      // We translate the trimmed string
      const translated = t(trimmed);
      
      // Preserve leading and trailing whitespaces
      const leadingSpace = node.match(/^\s*/)?.[0] || '';
      const trailingSpace = node.match(/\s*$/)?.[0] || '';
      return leadingSpace + translated + trailingSpace;
    }

    // 2. Pass numbers and booleans as is
    if (typeof node === 'number' || typeof node === 'boolean') {
      return node;
    }

    // 3. Handle arrays recursively
    if (Array.isArray(node)) {
      return node.map((child, index) => {
        const translatedChild = translateNode(child);
        // Preserve key if valid React element
        if (React.isValidElement(child) && child.key !== null) {
          return React.isValidElement(translatedChild)
            ? React.cloneElement(translatedChild, { key: child.key })
            : translatedChild;
        }
        return translatedChild;
      });
    }

    // 4. Handle React elements recursively
    if (React.isValidElement(node)) {
      // Avoid translating custom components that shouldn't be touched (like SVG, icons, etc.)
      const isHtmlElement = typeof node.type === 'string';
      const isSvg = isHtmlElement && (node.type === 'svg' || node.type === 'path');
      
      if (isSvg) {
        return node;
      }

      const props = { ...(node.props as any) };
      let hasChanges = false;

      // Translate standard attributes for built-in HTML tags
      if (isHtmlElement) {
        const propsToTranslate = ['placeholder', 'title', 'label', 'description'];
        propsToTranslate.forEach(prop => {
          if (typeof props[prop] === 'string' && props[prop].trim()) {
            const trimmed = props[prop].trim();
            if (!/^[0-9\s$-.,+:/()!%?*#]*$/.test(trimmed)) {
              props[prop] = t(trimmed);
              hasChanges = true;
            }
          }
        });
      }

      // Recursively translate children
      if (props.children !== undefined && props.children !== null) {
        const oldChildren = props.children;
        const newChildren = Array.isArray(oldChildren)
          ? oldChildren.map((c) => translateNode(c))
          : translateNode(oldChildren);
        
        props.children = newChildren;
        hasChanges = true;
      }

      if (hasChanges) {
        return React.cloneElement(node, props);
      }
    }

    return node;
  };

  return <>{translateNode(children)}</>;
};

export default AutoTranslate;
