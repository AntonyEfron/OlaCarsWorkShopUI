import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function useDOMTranslator() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const translateDOM = () => {
      const lng = i18n.language;
      const esResources = i18n.getResourceBundle('es', 'translation') || {};

      const walk = (node: Node) => {
        // 1. Handle elements
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          
          // Skip script, style, video, and audio tags
          if (['SCRIPT', 'STYLE', 'VIDEO', 'AUDIO', 'IFRAME', 'SVG', 'PATH'].includes(el.tagName)) {
            return;
          }

          // Skip elements marked not to be translated
          if (el.hasAttribute('data-no-translate') || el.closest?.('[data-no-translate]')) {
            return;
          }

          // Translate placeholders, titles, and labels
          const attrs = ['placeholder', 'title', 'label'];
          attrs.forEach(attr => {
            const val = el.getAttribute(attr);
            if (val) {
              const trimmed = val.trim();
              if (trimmed && !/^[0-9\s$-.,+:/()!%?*#]*$/.test(trimmed)) {
                // Store original value
                const origKey = `__orig_${attr}`;
                if (!(el as any)[origKey]) {
                  (el as any)[origKey] = val;
                }
                
                const origVal = (el as any)[origKey];
                if (lng === 'es') {
                  if (esResources[origVal]) {
                    el.setAttribute(attr, esResources[origVal]);
                  }
                } else {
                  el.setAttribute(attr, origVal);
                }
              }
            }
          });
        }

        // 2. Handle text nodes
        if (node.nodeType === Node.TEXT_NODE) {
          const val = node.nodeValue || '';
          const trimmed = val.trim();
          if (trimmed && !/^[0-9\s$-.,+:/()!%?*#]*$/.test(trimmed)) {
            // Store original text
            if (!(node as any).__originalText) {
              (node as any).__originalText = val;
            }

            const origText = (node as any).__originalText;
            const origTrimmed = origText.trim();
            
            if (lng === 'es') {
              if (esResources[origTrimmed]) {
                const leading = origText.match(/^\s*/)?.[0] || '';
                const trailing = origText.match(/\s*$/)?.[0] || '';
                node.nodeValue = leading + esResources[origTrimmed] + trailing;
              }
            } else {
              node.nodeValue = origText;
            }
          }
        }

        // 3. Recurse children
        let child = node.firstChild;
        while (child) {
          walk(child);
          child = child.nextSibling;
        }
      };

      walk(document.body);
    };

    // Run initial translation
    translateDOM();

    // Listen to i18n language changes
    i18n.on('languageChanged', translateDOM);

    // Setup MutationObserver to watch for additions/modifications to the DOM
    const observer = new MutationObserver(() => {
      // Disconnect observer temporarily to prevent infinite loop during translation updates
      observer.disconnect();
      translateDOM();
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'title', 'label']
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'label']
    });

    return () => {
      i18n.off('languageChanged', translateDOM);
      observer.disconnect();
    };
  }, [i18n.language]);
}

export default useDOMTranslator;
