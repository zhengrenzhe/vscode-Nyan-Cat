import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const STATUS_ITEM_ID = 'status';
const SCRIPT_FILE = 'nyan-cat.js';
// packaged through .vscodeignore, keep both in sync with the NyanCat.name options
const IMAGE_DIR = 'src/imgs';
const MARK_START = '<!-- nyan-cat-start -->';
const MARK_END = '<!-- nyan-cat-end -->';
const RELOAD_WINDOW = 'Reload Window';
// keep in sync with LABEL_PREFIX in nyan-cat.js
const STATUS_LABEL_PREFIX = 'Nyan Cat: ';

export function activate(context: vscode.ExtensionContext) {

    const barItem = vscode.window.createStatusBarItem(STATUS_ITEM_ID, vscode.StatusBarAlignment.Left);
    barItem.name = "Nyan Cat";
    barItem.text = "       ";
    barItem.tooltip = "Nyan Cat";
    showOnStatusBar(getName());
    barItem.show();

    // the workbench renders the item container with id `${extensionId}.${itemId}` (extension id lowercased)
    const statusItemDomId = `${context.extension.id.toLowerCase()}.${STATUS_ITEM_ID}`;

    const workbenchHtml = findWorkbenchHtml();
    if (!workbenchHtml) {
        vscode.window.showErrorMessage("Nyan Cat: cannot find workbench.html of this VS Code version.");
        return;
    }
    const htmlFilePath: string = workbenchHtml;
    const scriptFilePath = path.join(path.dirname(htmlFilePath), SCRIPT_FILE);

    // inject script & configuration
    if (run(install)) {
        promptReload("Nyan Cat: installed successful, reload Window to take effect.");
    }

    // manual inject configuration command
    const refreshCMD = vscode.commands.registerCommand('extension.NyanCatRefresh', () => {
        if (run(install) !== undefined) {
            promptReload("Nyan Cat: refresh successful, reload Window to take effect.");
        }
    });

    // uninstall command
    const uninstallCMD = vscode.commands.registerCommand('extension.NyanCatUninstall', () => {
        if (run(uninstall) !== undefined) {
            promptReload("Ready to uninstall Nyan Cat completed! Reload Window, then uninstall the extension.");
        }
    });

    // reload command
    const reloadCMD = vscode.commands.registerCommand('extension.NyanCatReload', () => {
        if (run(() => uninstall() && install()) !== undefined) {
            promptReload("Nyan Cat: reload successful, reload Window to take effect.");
        }
    });

    // select name command, previews the active item like the color theme picker, the configuration listener below re-injects it
    const selectCMD = vscode.commands.registerCommand('extension.NyanCatSelect', () => {
        const config = vscode.workspace.getConfiguration('NyanCat');
        const current = getName();

        const quickPick = vscode.window.createQuickPick();
        quickPick.title = "Nyan Cat";
        quickPick.placeholder = "Select a Nyan Cat to show (Up/Down keys to preview)";
        quickPick.items = nameOptions().map(name => ({ label: name, description: name === current ? 'current' : undefined }));
        quickPick.activeItems = quickPick.items.filter(item => item.label === current);

        let accepted = false;

        quickPick.onDidChangeActive(([item]) => item && showOnStatusBar(item.label));

        quickPick.onDidAccept(async () => {
            const picked = quickPick.selectedItems[0];
            if (!picked) return;
            accepted = true;
            quickPick.hide();
            if (picked.label === current) return;

            // update where the value is defined, otherwise a workspace value would override the user setting
            const inspect = config.inspect<string>('name');
            const target = inspect?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
            await config.update('name', picked.label, target);
        });

        // esc / focus out: restore the cat of the current setting
        quickPick.onDidHide(() => {
            if (!accepted) showOnStatusBar(current);
            quickPick.dispose();
        });

        quickPick.show();
    });

    // re-inject configuration whenever settings change
    const configListener = vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('NyanCat')) return;

        // the name is switched live through the status bar item, only the background color needs a reload
        showOnStatusBar(getName());
        if (run(install) && e.affectsConfiguration('NyanCat.backgroundColor')) {
            promptReload("Nyan Cat: configuration changed, reload Window to take effect.");
        }
    });

    context.subscriptions.push(barItem, refreshCMD, uninstallCMD, reloadCMD, selectCMD, configListener);

    /** Writes the script next to workbench.html and references it, returns true if any file changed. */
    function install(): boolean {
        let changed = false;

        const script = buildScript();
        if (readFileIfExists(scriptFilePath) !== script) {
            fs.writeFileSync(scriptFilePath, script, 'utf-8');
            changed = true;
        }

        // loaded from the same origin as workbench.js, so the CSP doesn't need 'unsafe-inline'.
        // only workbench.html is served with no-cache, the version query makes a reload pick up the new script
        const version = crypto.createHash('md5').update(script).digest('hex').slice(0, 8);
        const inject = `${MARK_START}<script src="./${SCRIPT_FILE}?v=${version}"></script>${MARK_END}`;
        const html = fs.readFileSync(htmlFilePath, 'utf-8');
        if (!html.includes(inject)) {
            const newHtml = removeInjection(html).replace('</html>', `${inject}\n</html>`);
            fs.writeFileSync(htmlFilePath, newHtml, 'utf-8');
            changed = true;
        }

        return changed;
    }

    /** Removes the injected script reference & file, returns true when done. */
    function uninstall(): boolean {
        const html = fs.readFileSync(htmlFilePath, 'utf-8');
        const newHtml = removeInjection(html);
        if (newHtml !== html) {
            fs.writeFileSync(htmlFilePath, newHtml, 'utf-8');
        }
        fs.rmSync(scriptFilePath, { force: true });
        return true;
    }

    function buildScript(): string {
        const config = vscode.workspace.getConfiguration('NyanCat');
        const names = nameOptions().filter(name => name !== 'random');

        // the vscode-file protocol serves .gif files from any path, so the workbench can load them from the extension folder
        const imageDir = context.asAbsolutePath(IMAGE_DIR);
        const imageBaseUrl = vscode.Uri.file(imageDir).with({ scheme: 'vscode-file', authority: 'vscode-app' }).toString();
        // images are cached like the script, the version makes a reload pick up changed gifs
        const imageHash = crypto.createHash('md5');
        for (const name of names) {
            imageHash.update(fs.readFileSync(path.join(imageDir, `${name}.gif`)));
        }

        const injectConfig = {
            name: config.get<string>('name', 'bday'),
            names,
            backgroundColor: config.get<string>('backgroundColor', 'transparent'),
            statusItemId: statusItemDomId,
            imageBaseUrl,
            imageVersion: imageHash.digest('hex').slice(0, 8),
        };
        const source = fs.readFileSync(path.join(__dirname, SCRIPT_FILE), 'utf-8');
        return `window.NyanCatConfiguration = ${JSON.stringify(injectConfig)};\n${source}`;
    }

    function getName(): string {
        return vscode.workspace.getConfiguration('NyanCat').get<string>('name', 'bday');
    }

    /** The injected script watches the item aria-label and switches the cat without reloading the window. */
    function showOnStatusBar(name: string) {
        barItem.accessibilityInformation = { label: `${STATUS_LABEL_PREFIX}${name}` };
    }

    /** Values of the NyanCat.name setting (including `random`). */
    function nameOptions(): string[] {
        return context.extension.packageJSON.contributes.configuration.properties['NyanCat.name'].enum;
    }
}

export function deactivate() {
}

function findWorkbenchHtml(): string | undefined {
    const codeDir = path.join(vscode.env.appRoot, 'out', 'vs', 'code');
    return [
        path.join(codeDir, 'electron-browser', 'workbench', 'workbench.html'),
        path.join(codeDir, 'electron-sandbox', 'workbench', 'workbench.html'),
    ].find(p => fs.existsSync(p));
}

function removeInjection(html: string): string {
    const start = html.indexOf(MARK_START);
    const end = html.indexOf(MARK_END);
    if (start === -1 || end === -1) return html;

    let cutEnd = end + MARK_END.length;
    if (html[cutEnd] === '\n') cutEnd++;
    return html.slice(0, start) + html.slice(cutEnd);
}

function readFileIfExists(filePath: string): string | undefined {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return undefined;
    }
}

/** Runs a file operation, shows an error message and returns undefined if it fails. */
function run<T>(action: () => T): T | undefined {
    try {
        return action();
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        const hint = code === 'EPERM' || code === 'EACCES'
            ? " Run VS Code as administrator (or fix the permission of the VS Code installation folder) and try again."
            : "";
        vscode.window.showErrorMessage(`Nyan Cat: ${(err as Error).message}.${hint}`);
        return undefined;
    }
}

function promptReload(message: string) {
    vscode.window.showInformationMessage(message, RELOAD_WINDOW).then(msg => {
        if (msg === RELOAD_WINDOW) {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
    });
}
