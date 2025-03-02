import * as vscode from "vscode";

// called once when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  console.log('"ocha.evaluate" is now active!');

  // The command has been defined in the package.json file
  const evaluateBufferCommand = vscode.commands.registerCommand(
    "Ocha.evaluateBuffer", () => { evaluateBuffer(context); }
  );
  context.subscriptions.push(evaluateBufferCommand);
}

// called once when the extension is deactivated
export function deactivate() { }

// Terminal to execute OCaml programs
let terminal: vscode.Terminal;

// called when "Ocha.evaluateBuffer" is executed
async function evaluateBuffer(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (editor.document.isDirty) editor.document.save();

  const ocamlCommand = await vscode.window.showInputBox({
    title: "OCaml toplevel to run",
    value: "utop"
  })
  if (!ocamlCommand) return;

  if (terminal) { terminal.dispose(); }
  terminal = vscode.window.createTerminal('ochaterm');
  terminal.show();

  await sendText(terminal, ocamlCommand);
  await sendText(terminal, '#use "' + editor.document.fileName + '";;');
}

async function sendText(terminal: vscode.Terminal, text: string) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  terminal.sendText(text);
}
