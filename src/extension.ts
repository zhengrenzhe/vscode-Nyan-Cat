'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import { dirname, normalize, basename } from 'path';
import * as f from 'file-url';

export function activate(context: vscode.ExtensionContext) {
    const htmlDirPath = normalize(`${dirname(require.main.filename)}/vs/workbench/electron-browser/bootstrap`);
    const htmlFilePath = normalize(`${htmlDirPath}/index.html`);
    const htmlBackupPath = normalize(`${htmlDirPath}/index-nyan-cat-backup.html`);

    // backup index.html
    backup();

    // inject js, add unsafe-inline csp
    injectScript();

    let item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    item.text = '             ';
    item.tooltip = 'Nyan Cat';
    item.show();
    
    // inject configuration
    injectConfiguration();

    // manual inject configuration command
    let refreshCMD = vscode.commands.registerCommand('extension.NyanCatRefresh', () => {
        injectConfiguration();
        vscode.window.showInformationMessage("Nyan Cat: refresh successful, reload Window to take effect.", 'Reload Window').then(msg => {
            msg === 'Reload Window' && vscode.commands.executeCommand("workbench.action.reloadWindow");
        });
    });

    // uninstall command
    let uninstallCMD = vscode.commands.registerCommand('extension.NyanCatUninstall', () => {
        prepareUninstall();
        vscode.window.showInformationMessage('Ready to uninstall Nyan Cat completed!');
    });

    // reload command
    let reloadCMD = vscode.commands.registerCommand('extension.NyanCatReload', () => {
        try {
            fs.statSync(htmlBackupPath);
        } catch (err) {
            if (err) return;
        }
        prepareUninstall();
        backup();
        injectScript();
        injectConfiguration();
        vscode.window.showInformationMessage("Nyan Cat: reload successful, reload Window to take effect.", 'Reload Window').then(msg => {
            msg === 'Reload Window' && vscode.commands.executeCommand("workbench.action.reloadWindow");
        });
    })

    context.subscriptions.push(refreshCMD);
    context.subscriptions.push(uninstallCMD);
    context.subscriptions.push(reloadCMD);

    function backup() {
        try {
            fs.statSync(htmlBackupPath);
        } catch (err) {
            if (err) {
                fs.writeFileSync(htmlBackupPath, fs.readFileSync(htmlFilePath));
            }
        }
    }

    function injectScript() {
        let htmlFileContent = fs.readFileSync(htmlFilePath, 'utf-8');
        if (!htmlFileContent.includes('nyan-cat.js')) {
            const inject = `<script src="${f(__dirname + '/nyan-cat.js')}"></script>`;
            htmlFileContent = htmlFileContent.replace('</html>', `${inject}\n</html>`);
            htmlFileContent = htmlFileContent.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
            fs.writeFileSync(htmlFilePath, htmlFileContent, 'utf-8');
        }
    }

    function injectConfiguration() {
        const config = vscode.workspace.getConfiguration('NyanCat');
        const inject = `<script id="NyanCatConfiguration">window.NyanCatConfiguration = ${JSON.stringify(config)}</script>`;
        let htmlFileContent = fs.readFileSync(htmlFilePath, 'utf-8');
        htmlFileContent = htmlFileContent.replace(/\t?<script.*NyanCatConfiguration.*script>\n?/g, '');
        htmlFileContent = htmlFileContent.replace('</body>', `${inject}\n</body>`);
        fs.writeFileSync(htmlFilePath, htmlFileContent, 'utf-8');
    }

    function prepareUninstall() {
        fs.unlinkSync(htmlFilePath);
        fs.renameSync(htmlBackupPath, htmlFilePath);
    }
}

export function deactivate() {
}
