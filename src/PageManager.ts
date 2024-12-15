export class PageManager {
    private static readonly REFRESH_SELECTOR = '[data-turbohref-refresh]';
    private static readonly PERMANENT_SELECTOR = '[data-turbohref-permanent]';

    public async update(newDocument: Document, options: UpdateOptions = {}): Promise<void> {
        this.triggerEvent('turbohref:before-render');

        if (options.partialReplace) {
            await this.performPartialUpdate(newDocument, options);
        } else {
            await this.performFullUpdate(newDocument);
        }

        this.triggerEvent('turbohref:render');
        this.executeScripts();
        this.updateScrollPosition();
    }

    private async performPartialUpdate(newDocument: Document, options: UpdateOptions): Promise<void> {
        const { onlyKeys = [], exceptKeys = [] } = options;

        if (onlyKeys.length > 0) {
            await this.updateMatchingElements(newDocument, onlyKeys);
        } else if (exceptKeys.length > 0) {
            await this.updateExceptElements(newDocument, exceptKeys);
        }
    }

    private async performFullUpdate(newDocument: Document): Promise<void> {
        // Preserve elements marked as permanent
        const permanentElements = document.querySelectorAll(PageManager.PERMANENT_SELECTOR);
        permanentElements.forEach(element => {
            const id = element.id;
            if (!id) throw new Error('Permanent elements must have an id');
            
            const newElement = newDocument.getElementById(id);
            if (newElement) {
                newElement.replaceWith(element.cloneNode(true));
            }
        });

        // Update the entire body
        document.body.replaceWith(newDocument.body.cloneNode(true));

        // Update the title if it changed
        if (newDocument.title !== document.title) {
            document.title = newDocument.title;
        }
    }

    private async updateMatchingElements(newDocument: Document, keys: string[]): Promise<void> {
        for (const key of keys) {
            const selector = `[data-turbohref-refresh="${key}"]`;
            const elements = document.querySelectorAll(selector);
            const newElements = newDocument.querySelectorAll(selector);

            elements.forEach((element, index) => {
                const newElement = newElements[index];
                if (newElement) {
                    element.replaceWith(newElement.cloneNode(true));
                }
            });
        }
    }

    private async updateExceptElements(newDocument: Document, keys: string[]): Promise<void> {
        const selectors = keys.map(key => `[data-turbohref-refresh="${key}"]`);
        const elementsToKeep = document.querySelectorAll(selectors.join(','));

        // Store the elements we want to keep
        const preserved = new Map();
        elementsToKeep.forEach(element => {
            const id = element.id;
            if (!id) throw new Error('Elements to preserve must have an id');
            preserved.set(id, element.cloneNode(true));
        });

        // Replace the body
        document.body.replaceWith(newDocument.body.cloneNode(true));

        // Restore the preserved elements
        preserved.forEach((element, id) => {
            const newElement = document.getElementById(id);
            if (newElement) {
                newElement.replaceWith(element);
            }
        });
    }

    private executeScripts(): void {
        const scripts = Array.from(document.getElementsByTagName('script'))
            .filter(script => !script.hasAttribute('data-turbohref-eval-false'));

        scripts.forEach(script => {
            const newScript = document.createElement('script');
            Array.from(script.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = script.textContent;
            script.parentNode?.replaceChild(newScript, script);
        });
    }

    private updateScrollPosition(): void {
        if (window.location.hash) {
            const element = document.getElementById(window.location.hash.slice(1));
            if (element) {
                element.scrollIntoView();
            }
        } else {
            window.scrollTo(0, 0);
        }
    }

    private triggerEvent(name: string, detail: any = {}): boolean {
        const event = new CustomEvent(name, {
            bubbles: true,
            cancelable: true,
            detail
        });
        return document.dispatchEvent(event);
    }
}

interface UpdateOptions {
    partialReplace?: boolean;
    onlyKeys?: string[];
    exceptKeys?: string[];
} 