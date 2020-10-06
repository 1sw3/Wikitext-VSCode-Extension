/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Rowe Wilson Frederisk Holme. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as MWBot from 'mwbot';
import { extensionContext } from '../../extension';
import { action, contextModel, alterNativeValues, prop } from '../wikimedia_function/mediawiki';
import { GetViewResult, GetViewConvert } from '../../interface_definition/getViewInterface';
import { bot as imbot } from '../wikimedia_function/wmcore';
import { getHost } from '../host_function/host';
import { EDESTADDRREQ } from 'constants';

/**
 * webview panel
 */
let currentPlanel: vscode.WebviewPanel | undefined = undefined;

export async function getPreview(): Promise<void> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("wikitext");
    const textEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
    // check is there an opened document.
    if (!textEditor) {
        vscode.window.showInformationMessage("No Active Wikitext Editor.");
        // if have not, cancle.
        return undefined;
    }
    const host: string | undefined = await getHost();
    if (!host) { return undefined; }
    if (!currentPlanel) {
        // if have not, try to creat new one.
        currentPlanel = vscode.window.createWebviewPanel(
            "previewer", "WikitextPreviewer", vscode.ViewColumn.Beside, {
            enableScripts: config.get("enableJavascript"),
        });
        // register for events that release resources.
        currentPlanel.onDidDispose(() => {
            currentPlanel = undefined;
        }, null, extensionContext.subscriptions);
    }
    // show loading status
    currentPlanel.webview.html = showHtmlInfo("Loading...");
    /** document text */
    const sourceText: string = textEditor.document.getText();

    const bot: MWBot = imbot ?? new MWBot({
        apiUrl: "https://" + host + config.get("apiPath")
    });

    /** arguments */
    const args = {
        'action': action.parse,
        'text': sourceText,
        'prop': alterNativeValues(prop.text, prop.displayTitle, (config.get("getCss") ? prop.headHTML : undefined)),
        'contentmodel': contextModel.wikitext,
        'pst': "yes",
        'disableeditsection': "yes"
    };

    try {
        const result = await bot?.request(args);
        const re: GetViewResult = GetViewConvert.toGetViewResult(result);
        // confirm the presence of the panel.
        if (!currentPlanel) {
            vscode.window.showInformationMessage("Preview Planel Not be Opened.");
            return undefined;
        }
        if (!re.parse) { return undefined; }
        const header: string = config.get("getCss") ? (re.parse.headhtml?.["*"] || ``) : `<!DOCTYPE html><html><body>`;
        const end: string = `</body></html>`;
        // show result.
        // if (wikiContent && header) {
        currentPlanel.webview.html = header + re.parse.text?.["*"] + end;

        currentPlanel.title = `WikitextPreviewer: ${re.parse.displaytitle}`;
    }
    catch (error) {
        vscode.window.showErrorMessage(`${error.code}! ${error.info}`);
    }

    function showHtmlInfo(info: string): string {
        return `
    <body>
        <section>
            <h2>
                ${info}
            </h2>
        </section>
    </body>`;
    }
}
