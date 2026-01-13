// XPath Generator Utility
class XPathGenerator {
  /**
   * Generate an optimized XPath for an element
   * Prioritizes: id > name > class > tag with position
   */
  static generate(element) {
    // If element has an ID, use it (most reliable)
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    // If element has a name attribute, use it
    if (element.name) {
      const tagName = element.tagName.toLowerCase();
      return `//${tagName}[@name="${element.name}"]`;
    }

    // Generate a full path-based XPath
    return this.getFullXPath(element);
  }

  /**
   * Generate full absolute XPath from root
   */
  static getFullXPath(element) {
    if (element.tagName === 'HTML') {
      return '/html';
    }

    if (element === document.body) {
      return '/html/body';
    }

    let siblings = Array.from(element.parentNode.childNodes).filter(
      node => node.nodeType === 1 && node.tagName === element.tagName
    );

    let index = siblings.indexOf(element) + 1;
    let tagName = element.tagName.toLowerCase();

    let pathSegment = siblings.length > 1 ? `${tagName}[${index}]` : tagName;

    return this.getFullXPath(element.parentNode) + '/' + pathSegment;
  }

  /**
   * Generate multiple XPath options for an element
   */
  static generateAll(element) {
    const xpaths = {
      optimized: this.generate(element),
      full: this.getFullXPath(element),
      byText: null,
      byClass: null
    };

    // Generate XPath by text content (for buttons, links, labels)
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length < 50) {
      const tagName = element.tagName.toLowerCase();
      xpaths.byText = `//${tagName}[normalize-space(text())="${textContent}"]`;
    }

    // Generate XPath by class
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/);
      if (classes.length > 0) {
        const tagName = element.tagName.toLowerCase();
        xpaths.byClass = `//${tagName}[@class="${element.className}"]`;
      }
    }

    return xpaths;
  }

  /**
   * Generate React Testing Library compatible selectors
   * Includes: data-testid, role-based, label-based queries
   */
  static getReactSelectors(element) {
    const selectors = {
      testId: null,
      role: null,
      labelText: null,
      placeholderText: null,
      text: null,
      displayValue: null,
      altText: null,
      title: null,
      dataTest: null,
      dataTestId: null
    };

    // 1. data-testid (React Testing Library standard)
    const testId = element.getAttribute('data-testid');
    if (testId) {
      selectors.testId = `getByTestId('${testId}')`;
      selectors.dataTestId = testId;
    }

    // 2. data-test (common alternative)
    const dataTest = element.getAttribute('data-test');
    if (dataTest) {
      selectors.dataTest = dataTest;
    }

    // 3. Role-based selector (ARIA role)
    const role = element.getAttribute('role') || this.getImplicitRole(element);
    if (role) {
      const name = this.getAccessibleName(element);
      if (name) {
        selectors.role = `getByRole('${role}', { name: '${name}' })`;
      } else {
        selectors.role = `getByRole('${role}')`;
      }
    }

    // 4. Label text (for form inputs)
    const label = this.findLabelText(element);
    if (label) {
      selectors.labelText = `getByLabelText('${label}')`;
    }

    // 5. Placeholder text
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      selectors.placeholderText = `getByPlaceholderText('${placeholder}')`;
    }

    // 6. Text content (for buttons, links, etc.)
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length < 50 && !element.querySelector('*')) {
      selectors.text = `getByText('${textContent}')`;
    }

    // 7. Display value (for inputs)
    if (element.value) {
      selectors.displayValue = `getByDisplayValue('${element.value}')`;
    }

    // 8. Alt text (for images)
    const alt = element.getAttribute('alt');
    if (alt) {
      selectors.altText = `getByAltText('${alt}')`;
    }

    // 9. Title attribute
    const title = element.getAttribute('title');
    if (title) {
      selectors.title = `getByTitle('${title}')`;
    }

    return selectors;
  }

  /**
   * Get implicit ARIA role for an element
   */
  static getImplicitRole(element) {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type');

    const roleMap = {
      'button': 'button',
      'a': element.href ? 'link' : null,
      'input': this.getInputRole(type),
      'textarea': 'textbox',
      'select': 'combobox',
      'img': 'img',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading',
      'nav': 'navigation',
      'main': 'main',
      'header': 'banner',
      'footer': 'contentinfo',
      'aside': 'complementary',
      'form': 'form',
      'table': 'table',
      'ul': 'list',
      'ol': 'list',
      'li': 'listitem'
    };

    return roleMap[tagName] || null;
  }

  /**
   * Get role for input elements based on type
   */
  static getInputRole(type) {
    const inputRoles = {
      'button': 'button',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'text': 'textbox',
      'email': 'textbox',
      'password': 'textbox',
      'search': 'searchbox',
      'tel': 'textbox',
      'url': 'textbox',
      'number': 'spinbutton',
      'range': 'slider'
    };

    return inputRoles[type] || 'textbox';
  }

  /**
   * Get accessible name for an element (label, aria-label, etc.)
   */
  static getAccessibleName(element) {
    // 1. aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // 2. aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) return labelElement.textContent.trim();
    }

    // 3. Associated label
    const label = this.findLabelText(element);
    if (label) return label;

    // 4. For buttons/links - text content
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      return element.textContent.trim();
    }

    // 5. Title attribute
    const title = element.getAttribute('title');
    if (title) return title;

    // 6. Alt text for images
    const alt = element.getAttribute('alt');
    if (alt) return alt;

    // 7. Placeholder as fallback
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;

    return '';
  }

  /**
   * Find label text for an input element
   */
  static findLabelText(element) {
    // Method 1: Label with for attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Method 2: Parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return parentLabel.textContent.trim();
    }

    return '';
  }

  /**
   * Generate CSS selector as alternative
   */
  static getCssSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.name) {
      const tagName = element.tagName.toLowerCase();
      return `${tagName}[name="${element.name}"]`;
    }

    // Build path-based CSS selector
    const path = [];
    let current = element;

    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).join('.');
        if (classes) {
          selector += `.${classes}`;
        }
      }

      // Add nth-child if needed
      const siblings = Array.from(current.parentNode.children).filter(
        el => el.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }

      path.unshift(selector);
      current = current.parentNode;
    }

    return path.join(' > ');
  }
}

// Make available globally
window.XPathGenerator = XPathGenerator;
