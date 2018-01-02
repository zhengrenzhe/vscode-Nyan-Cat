'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import { dirname, normalize, basename } from 'path';
import * as f from 'file-url';

export function activate(context: vscode.ExtensionContext) {
    const htmlDirPath = normalize(`${dirname(require.main.filename)}/vs/workbench/electron-browser/bootstrap`);
    const htmlFilePath = normalize(`${htmlDirPath}/index.html`);

    try {
        fs.statSync(normalize(`${htmlDirPath}/index-nyan-cat-backup.html`));
    } catch (err) {
        if (err) {
            fs.writeFileSync(normalize(`${htmlDirPath}/index-nyan-cat-backup.html`), fs.readFileSync(htmlFilePath));
        }
    }

    let htmlFileContent = fs.readFileSync(htmlFilePath, 'utf-8');
    if (!htmlFileContent.includes('nyan-cat.js')) {
        const inject = `<script src="${f(__dirname + '/nyan-cat.js')}"></script>`;
        htmlFileContent = htmlFileContent.replace('</html>', `${inject}\n</html>`);
        fs.writeFileSync(htmlFilePath, htmlFileContent, 'utf-8');
    }

    let item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    item.text = '                         ';
    item.tooltip = 'Nyan cat';
    item.show()
}

export function deactivate() {
}
