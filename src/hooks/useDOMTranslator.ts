import { useEffect } from "react";
import { useTranslation } from "react-i18next";

// Helper to recursively find a value in a nested object and return its key path
function findValuePath(obj: any, value: string): string[] | null {
  const normalizedVal = value.trim().toLowerCase();

  function recurse(current: any, path: string[]): string[] | null {
    if (typeof current === "string") {
      if (current.trim().toLowerCase() === normalizedVal) {
        return path;
      }
      return null;
    }
    if (current && typeof current === "object") {
      for (const key in current) {
        const result = recurse(current[key], [...path, key]);
        if (result) return result;
      }
    }
    return null;
  }

  return recurse(obj, []);
}

// Helper to get value at key path
function getValueAtPath(obj: any, path: string[]): any {
  let current = obj;
  for (const key of path) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}

export function useDOMTranslator() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const translateDOM = () => {
      const lng = i18n.language;
      const esResources = i18n.getResourceBundle("es", "translation") || {};
      const enResources = i18n.getResourceBundle("en", "translation") || {};

      const getEnglishOriginal = (str: string) => {
        const trimmed = str.trim();
        if (!trimmed) return str;

        if (lng === "es") {
          const path = findValuePath(esResources, trimmed);
          if (path) {
            const enVal = getValueAtPath(enResources, path);
            if (typeof enVal === "string") {
              const leading = str.match(/^\s*/)?.[0] || "";
              const trailing = str.match(/\s*$/)?.[0] || "";
              return leading + enVal + trailing;
            }
          }
        }
        return str;
      };

      const getTranslationForString = (str: string) => {
        const trimmed = str.trim();
        if (!trimmed) return null;

        // 1. Direct match at root level of esResources
        if (typeof esResources[trimmed] === "string") {
          return esResources[trimmed];
        }

        // 2. Search nested enResources to find the path, then look up in esResources
        const path = findValuePath(enResources, trimmed);
        if (path) {
          const translated = getValueAtPath(esResources, path);
          if (typeof translated === "string") {
            return translated;
          }
        }

        return null;
      };

      const walk = (node: Node) => {
        // 1. Handle elements
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;

          if (
            ["SCRIPT", "STYLE", "VIDEO", "AUDIO", "IFRAME", "SVG", "PATH"].includes(
              el.tagName,
            )
          ) {
            return;
          }

          if (
            el.hasAttribute("data-no-translate") ||
            el.closest?.("[data-no-translate]")
          ) {
            return;
          }

          const attrs = ["placeholder", "title", "label"];
          attrs.forEach((attr) => {
            const val = el.getAttribute(attr);
            if (val) {
              const trimmed = val.trim();
              if (trimmed && !/^[0-9\s$-.,+:/()!%?*#]*$/.test(trimmed)) {
                const origKey = `__orig_${attr}`;
                if (!(el as any)[origKey]) {
                  (el as any)[origKey] = getEnglishOriginal(val);
                }

                const origVal = (el as any)[origKey];
                if (lng === "es") {
                  const translated = getTranslationForString(origVal);
                  if (translated) {
                    el.setAttribute(attr, translated);
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
          const val = node.nodeValue || "";
          const trimmed = val.trim();
          if (trimmed && !/^[0-9\s$-.,+:/()!%?*#]*$/.test(trimmed)) {
            if (!(node as any).__originalText) {
              (node as any).__originalText = getEnglishOriginal(val);
            }

            const origText = (node as any).__originalText;
            const origTrimmed = origText.trim();

            if (lng === "es") {
              const translated = getTranslationForString(origTrimmed);
              if (translated) {
                const leading = origText.match(/^\s*/)?.[0] || "";
                const trailing = origText.match(/\s*$/)?.[0] || "";
                node.nodeValue = leading + translated + trailing;
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

    translateDOM();

    i18n.on("languageChanged", translateDOM);

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();

      mutations.forEach((mutation) => {
        if (mutation.type === "characterData" && mutation.target) {
          delete (mutation.target as any).__originalText;
        } else if (
          mutation.type === "attributes" &&
          mutation.target &&
          mutation.attributeName
        ) {
          delete (mutation.target as any)[`__orig_${mutation.attributeName}`];
        }
      });

      translateDOM();

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "title", "label"],
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "label"],
    });

    return () => {
      i18n.off("languageChanged", translateDOM);
      observer.disconnect();
    };
  }, [i18n.language]);
}

export default useDOMTranslator;
