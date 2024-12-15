export class PageManager {
    private static readonly PERMANENT_SELECTOR = '[data-turbohref-permanent]';
    private executedScripts: Set<string> = new Set();

    constructor() {
        this.trackExistingScripts();
    }

    public async update(newDocument: Document, options: UpdateOptions = {}): Promise<void> {
        console.log('Starting page update...', {
            partialReplace: options.partialReplace,
            onlyKeys: options.onlyKeys,
            exceptKeys: options.exceptKeys
        });

        this.triggerEvent('turbohref:before-render');

        if (options.partialReplace) {
            console.log('Performing partial update...');
            await this.performPartialUpdate(newDocument, options);
        } else {
            console.log('Performing full page update...');
            await this.performFullUpdate(newDocument);
        }

        this.triggerEvent('turbohref:render');
        this.executeScripts();
        this.updateScrollPosition();

        console.log('Page update complete');
    }

    private trackExistingScripts(): void {
        const scripts = Array.from(document.getElementsByTagName('script'));
        scripts.forEach(script => {
            const identifier = this.getScriptIdentifier(script);
            if (identifier) {
                this.executedScripts.add(identifier);
            }
        });
    }

    private getScriptIdentifier(script: HTMLScriptElement): string {
        // Use src if it's an external script, otherwise use content hash
        return script.src || script.textContent || '';
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
        console.log(`Found ${permanentElements.length} permanent elements to preserve`);
        
        permanentElements.forEach(element => {
            const id = element.id;
            if (!id) throw new Error('Permanent elements must have an id');
            
            const newElement = newDocument.getElementById(id);
            if (newElement) {
                console.log(`Preserving permanent element with id: ${id}`);
                newElement.replaceWith(element.cloneNode(true));
            }
        });

        // Update the entire body
        console.log('Replacing entire body content');
        document.body.replaceWith(newDocument.body.cloneNode(true));

        // TODO: Should we perform more differential injection of the new style elements?
        document.head.replaceWith(newDocument.head.cloneNode(true));

        // Update the title if it changed
        if (newDocument.title !== document.title) {
            console.log(`Updating page title from "${document.title}" to "${newDocument.title}"`);
            document.title = newDocument.title;
        }
    }

    private async updateMatchingElements(newDocument: Document, keys: string[]): Promise<void> {
        console.log(`Updating elements matching keys:`, keys);
        
        for (const key of keys) {
            const selector = `[data-turbohref-refresh="${key}"]`;
            const elements = document.querySelectorAll(selector);
            const newElements = newDocument.querySelectorAll(selector);

            console.log(`Found ${elements.length} existing and ${newElements.length} new elements for key "${key}"`);

            elements.forEach((element, index) => {
                const newElement = newElements[index];
                if (newElement) {
                    element.replaceWith(newElement.cloneNode(true));
                } else {
                    console.warn(`No matching new element found for index ${index} with key "${key}"`);
                }
            });
        }
    }

    private async updateExceptElements(newDocument: Document, keys: string[]): Promise<void> {
        console.log(`Preserving elements except for keys:`, keys);
        
        const selectors = keys.map(key => `[data-turbohref-refresh="${key}"]`);
        const elementsToKeep = document.querySelectorAll(selectors.join(','));
        console.log(`Found ${elementsToKeep.length} elements to preserve`);

        // Store the elements we want to keep
        const preserved = new Map();
        elementsToKeep.forEach(element => {
            const id = element.id;
            if (!id) throw new Error('Elements to preserve must have an id');
            preserved.set(id, element.cloneNode(true));
        });

        // Replace the body
        console.log('Replacing body content while preserving selected elements');
        document.body.replaceWith(newDocument.body.cloneNode(true));

        // Restore the preserved elements
        console.log('Restoring preserved elements');
        preserved.forEach((element, id) => {
            const newElement = document.getElementById(id);
            if (newElement) {
                newElement.replaceWith(element);
            } else {
                console.warn(`Could not find element with id "${id}" in new document to restore preserved content`);
            }
        });
    }

    private executeScripts(): void {
        console.log("Executing scripts...");
        const scripts = Array.from(document.getElementsByTagName('script'))
            .filter(script => !script.hasAttribute('data-turbohref-eval-false'));

        scripts.forEach(script => {
            const identifier = this.getScriptIdentifier(script);
            console.log("Executing script:", identifier);
            
            // Skip if this script has already been executed
            if (this.executedScripts.has(identifier)) {
                return;
            }

            const newScript = document.createElement('script');
            Array.from(script.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = script.textContent;

            // Track this script as executed
            this.executedScripts.add(identifier);
            
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