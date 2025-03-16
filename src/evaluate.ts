import * as vscode from "vscode";
import * as child_process from 'child_process';

// the OCaml command to run
let ocamlCommandName: string = "";

// called once when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  console.log('"ocha.evaluate" is now active!');

  // Determine the OCaml command to run
  try {
    child_process.execSync("utop -version");
    ocamlCommandName = "utop";
  } catch (error) {
    try {
      child_process.execSync("rlwrap -version");
      ocamlCommandName = "rlwrap ocaml";
    } catch (error) {
      ocamlCommandName = "ocaml";
    }
  }

  // The command has been defined in the package.json file
  const evaluateBufferCommand = vscode.commands.registerCommand(
    "Ocha.evaluateBuffer", () => { evaluateBuffer(); }
  );
  context.subscriptions.push(evaluateBufferCommand);
}

// called once when the extension is deactivated
export function deactivate() { }

// Terminal to execute OCaml programs
let terminal: vscode.Terminal;

// called when "Ocha.evaluateBuffer" is executed
async function evaluateBuffer() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (editor.document.isDirty) {
    const result = await editor.document.save();
    if (!result) return;
  }

  const ocamlCommand = await vscode.window.showInputBox({
    title: "OCaml toplevel to run",
    value: ocamlCommandName
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
