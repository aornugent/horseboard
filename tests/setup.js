// Mock browser globals for Node.js test environment
// Import this file before any client code that uses browser APIs

if (typeof window === 'undefined') {
    global.window = {
        location: { origin: 'http://localhost', pathname: '/' }
    };
}

if (typeof localStorage === 'undefined') {
    global.localStorage = {
        _data: {},
        getItem(key) { return this._data[key] ?? null; },
        setItem(key, value) { this._data[key] = value; },
        removeItem(key) { delete this._data[key]; },
        clear() { this._data = {}; }
    };
}
