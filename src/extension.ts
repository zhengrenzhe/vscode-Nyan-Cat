'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import { dirname, normalize, basename } from 'path';
import * as f from 'file-url';

export function activate(context: vscode.ExtensionContext) {
    const htmlDirPath = normalize(`${dirname(require.main.filename)}/vs/workbench/electron-browser/bootstrap`);
    const htmlFilePath = normalize(`${htmlDirPath}/index.html`);

    // backup index.html
    try {
        fs.statSync(normalize(`${htmlDirPath}/index-nyan-cat-backup.html`));
    } catch (err) {
        if (err) {
            fs.writeFileSync(normalize(`${htmlDirPath}/index-nyan-cat-backup.html`), fs.readFileSync(htmlFilePath));
        }
    }

    // inject js, add unsafe-inline csp 
    let htmlFileContent = fs.readFileSync(htmlFilePath, 'utf-8');
    if (!htmlFileContent.includes('nyan-cat.js')) {
        const inject = `<script src="${f(__dirname + '/nyan-cat.js')}"></script>`;
        htmlFileContent = htmlFileContent.replace('</html>', `${inject}\n</html>`);
        htmlFileContent = htmlFileContent.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
        fs.writeFileSync(htmlFilePath, htmlFileContent, 'utf-8');
    }

    let item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    item.text = '             ';
    item.tooltip = 'Nyan Cat';
    item.show();
    
    // inject configuration
    injectConfiguration();

    // manual inject configuration 
    let refreshCMD = vscode.commands.registerCommand('extension.NyanCatRefresh', () => {
        injectConfiguration();
        vscode.window.showInformationMessage("Nyan Cat: refresh successful, reload to take effect.", 'Reload Window').then(msg => {
            msg === 'Reload Window' && vscode.commands.executeCommand("workbench.action.reloadWindow");
        });
    });

    context.subscriptions.push(refreshCMD);

    function injectConfiguration() {
        const config = vscode.workspace.getConfiguration('NyanCat');
        const inject = `<script id="NyanCatConfiguration">window.NyanCatConfiguration = ${JSON.stringify(config)}</script>`;
        let htmlFileContent = fs.readFileSync(htmlFilePath, 'utf-8');
        htmlFileContent = htmlFileContent.replace(/<script.*NyanCatConfiguration.*script>/, '');
        htmlFileContent = htmlFileContent.replace('</body>', `${inject}\n</body>`);
        fs.writeFileSync(htmlFilePath, htmlFileContent, 'utf-8');
    }
}

export function deactivate() {
}
