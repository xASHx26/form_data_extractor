// Random Data Generator — generates realistic test values for form elements
const RandomDataGenerator = (() => {
    'use strict';

    const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy', 'Anthony', 'Betty', 'Mark', 'Margaret', 'Steven', 'Sandra', 'Andrew', 'Ashley', 'Paul', 'Dorothy', 'Joshua', 'Kimberly', 'Kenneth', 'Emily', 'Kevin', 'Donna'];
    const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
    const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Antonio', 'San Diego', 'Dallas', 'Austin', 'Jacksonville', 'San Francisco', 'Seattle', 'Denver', 'Boston', 'Portland'];
    const STREETS = ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Elm St', 'Pine Rd', 'Washington Blvd', 'Park Ave', 'Lake Dr', 'Hill St', 'River Rd', 'Forest Ave', 'Sunset Blvd', 'Broadway'];
    const COMPANIES = ['Acme Corp', 'TechVentures', 'DataFlow Inc', 'CloudPeak', 'NovaStar', 'BlueLake Systems', 'GreenField Labs', 'SilverLine', 'Apex Digital', 'Zenith Solutions'];
    const DOMAINS = ['example.com', 'test.org', 'demo.net', 'sample.io', 'mail.com'];
    const LOREM = ['Lorem ipsum dolor sit amet, consectetur adipiscing elit.', 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.', 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.', 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.', 'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.', 'Neque porro quisquam est qui dolorem ipsum quia dolor sit amet.', 'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse.'];
    const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Japan', 'Brazil', 'India', 'Mexico'];
    const STATES = ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'Michigan', 'North Carolina'];

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randBool() { return Math.random() > 0.5; }

    function firstName() { return pick(FIRST_NAMES); }
    function lastName() { return pick(LAST_NAMES); }
    function fullName() { return `${firstName()} ${lastName()}`; }
    function email() { return `${firstName().toLowerCase()}.${lastName().toLowerCase()}${randInt(1, 999)}@${pick(DOMAINS)}`; }
    function phone() { return `+1-${randInt(200, 999)}-${randInt(200, 999)}-${String(randInt(1000, 9999))}`; }
    function address() { return `${randInt(100, 9999)} ${pick(STREETS)}`; }
    function city() { return pick(CITIES); }
    function state() { return pick(STATES); }
    function country() { return pick(COUNTRIES); }
    function zipCode() { return String(randInt(10000, 99999)); }
    function company() { return pick(COMPANIES); }
    function url() { return `https://www.${pick(DOMAINS)}/${lastName().toLowerCase()}`; }
    function password() {
        const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
        let pw = '';
        for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
        return pw;
    }
    function loremSentences(n) { const s = []; for (let i = 0; i < (n || 2); i++) s.push(pick(LOREM)); return s.join(' '); }
    function randomDate(minYear, maxYear) {
        const y = randInt(minYear || 1990, maxYear || 2025);
        const m = String(randInt(1, 12)).padStart(2, '0');
        const d = String(randInt(1, 28)).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    function randomTime() { return `${String(randInt(0, 23)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`; }
    function randomColor() { return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'); }
    function randomNumber(min, max, step) {
        min = parseFloat(min) || 0;
        max = parseFloat(max) || 100;
        step = parseFloat(step) || 1;
        const steps = Math.floor((max - min) / step);
        return min + Math.floor(Math.random() * (steps + 1)) * step;
    }
    function username() { return `${firstName().toLowerCase()}${randInt(1, 9999)}`; }
    function randomWord(len) {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let w = '';
        for (let i = 0; i < (len || randInt(5, 12)); i++) w += chars[Math.floor(Math.random() * chars.length)];
        return w;
    }

    // Heuristic field detection from id, name, placeholder, label
    function detectFieldSemantic(element) {
        const hints = [
            element.id || '',
            element.name || '',
            element.placeholder || '',
            element.label || '',
            element.ariaLabel || ''
        ].join(' ').toLowerCase();

        if (/\b(first.?name|fname|given.?name)\b/.test(hints)) return 'firstName';
        if (/\b(last.?name|lname|surname|family.?name)\b/.test(hints)) return 'lastName';
        if (/\b(full.?name|your.?name|display.?name)\b/.test(hints)) return 'fullName';
        if (/\buser.?name|login.?name|uname\b/.test(hints)) return 'username';
        if (/\be.?mail\b/.test(hints)) return 'email';
        if (/\b(phone|mobile|tel|cell)\b/.test(hints)) return 'phone';
        if (/\b(address|street|addr)\b/.test(hints)) return 'address';
        if (/\b(city|town)\b/.test(hints)) return 'city';
        if (/\b(state|province|region)\b/.test(hints)) return 'state';
        if (/\b(country|nation)\b/.test(hints)) return 'country';
        if (/\b(zip|postal|postcode)\b/.test(hints)) return 'zip';
        if (/\b(company|org|organization|employer)\b/.test(hints)) return 'company';
        if (/\b(website|url|homepage|site)\b/.test(hints)) return 'url';
        if (/\b(password|passwd|pwd|pass)\b/.test(hints)) return 'password';
        if (/\b(message|comment|description|bio|about|note|feedback|reason|details|summary)\b/.test(hints)) return 'text_long';
        if (/\b(subject|title|heading)\b/.test(hints)) return 'subject';
        if (/\b(age)\b/.test(hints)) return 'age';
        if (/\b(dob|birth|birthday)\b/.test(hints)) return 'date';
        if (/\bsearch\b/.test(hints)) return 'search';
        if (/\bname\b/.test(hints)) return 'fullName';
        return null;
    }

    /**
     * Generate a random value for a single element descriptor.
     * @param {Object} el - element data from extraction (has id, name, type, label, placeholder, options, groupOptions, etc.)
     * @returns {{ value: string|boolean, displayValue: string }}
     */
    function generateForElement(el) {
        const type = (el.type || 'text').toLowerCase();
        const semantic = detectFieldSemantic(el);

        // Select dropdowns
        if (type === 'select' || type === 'select-one' || type === 'select-multiple' || el.tagName === 'select') {
            const opts = (el.options || []).filter(o => o.value && !o.disabled && o.value !== '');
            if (opts.length === 0) return { value: '', displayValue: '(no options)' };
            const chosen = pick(opts);
            return { value: chosen.value, displayValue: chosen.text || chosen.value };
        }

        // Radio
        if (type === 'radio') {
            const opts = (el.groupOptions || []).filter(o => !o.disabled);
            if (opts.length === 0) return { value: '', displayValue: '(no options)' };
            const chosen = pick(opts);
            return { value: chosen.value, displayValue: chosen.label || chosen.value };
        }

        // Checkbox
        if (type === 'checkbox') {
            const v = randBool();
            return { value: v, displayValue: v ? 'Checked' : 'Unchecked' };
        }

        // File — cannot fill
        if (type === 'file') return { value: '', displayValue: '(file – skipped)' };

        // Hidden — skip
        if (type === 'hidden') return { value: '', displayValue: '(hidden – skipped)' };

        // Submit / button — skip
        if (type === 'submit' || type === 'button' || type === 'reset' || el.tagName === 'button') {
            return { value: '', displayValue: '(button – skipped)' };
        }

        // Date types
        if (type === 'date' || semantic === 'date') return { value: randomDate(1990, 2005), displayValue: randomDate(1990, 2005) };
        if (type === 'datetime-local') { const d = randomDate(); return { value: `${d}T${randomTime()}`, displayValue: `${d} ${randomTime()}` }; }
        if (type === 'time') { const t = randomTime(); return { value: t, displayValue: t }; }
        if (type === 'month') { const v = `${randInt(2000, 2025)}-${String(randInt(1, 12)).padStart(2, '0')}`; return { value: v, displayValue: v }; }
        if (type === 'week') { const v = `${randInt(2020, 2025)}-W${String(randInt(1, 52)).padStart(2, '0')}`; return { value: v, displayValue: v }; }

        // Number / range
        if (type === 'number' || type === 'range') {
            const attrs = el.attributes || {};
            const v = randomNumber(attrs.min, attrs.max, attrs.step);
            return { value: String(v), displayValue: String(v) };
        }

        // Color
        if (type === 'color') { const c = randomColor(); return { value: c, displayValue: c }; }

        // Textarea
        if (el.tagName === 'textarea' || type === 'textarea') {
            const t = loremSentences(2);
            return { value: t, displayValue: t.substring(0, 60) + '...' };
        }

        // Text inputs — use semantics
        if (semantic === 'firstName') { const v = firstName(); return { value: v, displayValue: v }; }
        if (semantic === 'lastName') { const v = lastName(); return { value: v, displayValue: v }; }
        if (semantic === 'fullName') { const v = fullName(); return { value: v, displayValue: v }; }
        if (semantic === 'username') { const v = username(); return { value: v, displayValue: v }; }
        if (semantic === 'email' || type === 'email') { const v = email(); return { value: v, displayValue: v }; }
        if (semantic === 'phone' || type === 'tel') { const v = phone(); return { value: v, displayValue: v }; }
        if (semantic === 'address') { const v = address(); return { value: v, displayValue: v }; }
        if (semantic === 'city') { const v = city(); return { value: v, displayValue: v }; }
        if (semantic === 'state') { const v = state(); return { value: v, displayValue: v }; }
        if (semantic === 'country') { const v = country(); return { value: v, displayValue: v }; }
        if (semantic === 'zip') { const v = zipCode(); return { value: v, displayValue: v }; }
        if (semantic === 'company') { const v = company(); return { value: v, displayValue: v }; }
        if (semantic === 'url' || type === 'url') { const v = url(); return { value: v, displayValue: v }; }
        if (semantic === 'password' || type === 'password') { const v = password(); return { value: v, displayValue: v }; }
        if (semantic === 'text_long') { const v = loremSentences(2); return { value: v, displayValue: v.substring(0, 60) + '...' }; }
        if (semantic === 'subject') { const v = `Test Subject ${randInt(1, 999)}`; return { value: v, displayValue: v }; }
        if (semantic === 'age') { const v = String(randInt(18, 75)); return { value: v, displayValue: v }; }
        if (semantic === 'search') { const v = randomWord(8); return { value: v, displayValue: v }; }

        // Fallback type-based
        if (type === 'email') { const v = email(); return { value: v, displayValue: v }; }
        if (type === 'tel') { const v = phone(); return { value: v, displayValue: v }; }
        if (type === 'url') { const v = url(); return { value: v, displayValue: v }; }
        if (type === 'password') { const v = password(); return { value: v, displayValue: v }; }

        // Generic text fallback
        const v = randomWord(randInt(5, 10));
        return { value: v, displayValue: v };
    }

    /**
     * Generate a full test scenario from extracted elements.
     * @param {Array} elements - array of element data objects from extraction
     * @returns {Array<{index, id, name, label, type, tagName, selector, value, displayValue, skipped}>}
     */
    function generateScenario(elements) {
        return elements.map((el, idx) => {
            const gen = generateForElement(el);
            const isSkipped = gen.value === '' && gen.displayValue.startsWith('(');
            // Best selector to locate the element
            const selector = el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : (el.cssSelector || el.xpath || ''));
            return {
                index: idx,
                fillOrder: idx,
                waitAfter: 0,
                id: el.id || '',
                name: el.name || '',
                label: el.label || el.ariaLabel || el.placeholder || '',
                type: el.type || 'text',
                tagName: el.tagName || 'input',
                selector: selector,
                xpath: el.xpath || '',
                cssSelector: el.cssSelector || '',
                value: gen.value,
                displayValue: gen.displayValue,
                skipped: isSkipped,
                // Keep options/groupOptions for editing UI
                options: el.options || null,
                groupOptions: el.groupOptions || null
            };
        });
    }

    return {
        generateForElement,
        generateScenario,
        firstName, lastName, fullName, email, phone, address, city, state, country, zipCode,
        company, url, password, loremSentences, randomDate, randomTime, randomColor, randomNumber,
        username, randomWord, pick, randInt, randBool
    };
})();

// Make available globally (works in both content script and popup contexts)
if (typeof window !== 'undefined') window.RandomDataGenerator = RandomDataGenerator;
