require('jest-fetch-mock').enableMocks(); 

// Mock scrollTo and scrollIntoView since they're not implemented in jsdom
window.scrollTo = jest.fn();
Element.prototype.scrollIntoView = jest.fn();

// Helper to create a new page with custom HTML
global.createTestPage = (html) => {
    document.documentElement.innerHTML = html;
    return document;
};

// Helper to create a mock response
global.createMockResponse = (html, status = 200) => {
    return new Response(html, {
        status,
        headers: { 'Content-Type': 'text/html' }
    });
};

// Helper to wait for all promises to resolve
global.flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));