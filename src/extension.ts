// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as evaluate from "./evaluate"
import * as step from "./step"

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('"ocha-platform" is now active!');

  evaluate.activate(context);
  step.activate(context);
}

// This method is called when your extension is deactivated
export function deactivate() {
  evaluate.deactivate();
  step.deactivate();
}
