import * as vscode from 'vscode';

export class LogServerContext {
    private _isServerRunning: boolean = false;

    // Getter for the current state
    get isServerRunning(): boolean {
        return this._isServerRunning;
    }

    // Setter for the state, updates the context key
    set isServerRunning(value: boolean) {
        this._isServerRunning = value;
        vscode.commands.executeCommand('setContext', 'logServer:isRunning', value);
    }
}

 
