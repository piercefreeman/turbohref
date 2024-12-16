export declare class PageManager {
    private static readonly PERMANENT_SELECTOR;
    update(newDocument: Document, options?: UpdateOptions): Promise<void>;
    private performPartialUpdate;
    private performFullUpdate;
    private updateMatchingElements;
    private updateExceptElements;
    private executeScripts;
    private updateScrollPosition;
    private triggerEvent;
}
interface UpdateOptions {
    partialReplace?: boolean;
    onlyKeys?: string[];
    exceptKeys?: string[];
}
export {};
//# sourceMappingURL=PageManager.d.ts.map