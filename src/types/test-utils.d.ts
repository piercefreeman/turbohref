declare global {
    function createTestPage(html: string): Document;
    function createMockResponse(html: string, status?: number): Response;
    function flushPromises(): Promise<void>;

    interface Window {
        scriptExecuted?: jest.Mock;
    }
}

export {}; 