import * as vscode from "vscode";
import * as child_process from 'child_process';
import * as path from 'path';

// the OCaml command to run
let ocamlCommandName: string = "";

// whether dune and utop are both installed
let duneUtopInstalled: boolean = false;

// called once when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  console.log('"ocha.evaluate" is now active!');

  // Determine the OCaml command to run
  try {
    child_process.execSync("utop -version");
    try {
      child_process.execSync("dune --version");
      duneUtopInstalled = true;
      ocamlCommandName = "dune utop";
    } catch (error) {
      ocamlCommandName = "utop";
    }
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
    "Ocha.evaluateBuffer", () => { evaluateBuffer(context); }
  );
  context.subscriptions.push(evaluateBufferCommand);

  const makeCommand = vscode.commands.registerCommand(
    "Ocha.make", () => { make(); }
  );
  context.subscriptions.push(makeCommand);

  const setOCamlCommand = vscode.commands.registerCommand(
    "Ocha.setOCamlCommandName", () => { setOCamlCommandName(); }
  );
  context.subscriptions.push(setOCamlCommand);
}

// called once when the extension is deactivated
export function deactivate() { }

// Terminal to execute OCaml programs
let terminal: vscode.Terminal;

// called when "Ocha.evaluateBuffer" is executed
export async function evaluateBuffer(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (editor.document.isDirty) {
    const result = await editor.document.save();
    if (!result) return;
  }

  let projectRootDir = path.dirname(editor.document.uri.fsPath);

  // check if the file to be executed is in the dune project
  if (duneUtopInstalled) {
    try {
      projectRootDir = child_process.execSync(
        context.extensionPath +
        "/scripts/show-root " + projectRootDir).toString().trim();
      ocamlCommandName = "dune utop";
    } catch (error) {
      ocamlCommandName = "utop";
    }
  }

  if (terminal) { terminal.dispose(); }
  terminal = vscode.window.createTerminal({
    name: 'ochaterm',
    cwd: projectRootDir
  });
  terminal.show();

  const useFilePath: string = context.extensionPath + "/scripts/use-file";

  try {
    child_process.execSync("/usr/bin/expect -v");
    await sendText(terminal,
      useFilePath + " " + editor.document.fileName + " " + ocamlCommandName);
  } catch (error) {
    await sendText(terminal, ocamlCommandName);
    await sendText(terminal, '#use "' + editor.document.fileName + '";;');
  }
}

// check if a given file exists
async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (err: any) {
    if (err.code === 'FileNotFound' || err.name === 'EntryNotFound' ||
      err.message.includes('ENOENT')) {
      return false;
    }
    throw err; // Rethrow if it's a different error
  }
}

// send text to terminal
async function sendText(terminal: vscode.Terminal, text: string) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  terminal.sendText(text);
}

// called when "Ocha.make" is executed
async function make() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (editor.document.isDirty) {
    const result = await editor.document.save();
    if (!result) return;
  }

  if (terminal) { terminal.dispose(); }
  terminal = vscode.window.createTerminal('ochaterm');
  terminal.show();

  await sendText(terminal, "make");
}

// called when "Ocha.setOCamlCommand" is executed
async function setOCamlCommandName() {
  const ocamlCommand = await vscode.window.showInputBox({
    title: "OCaml toplevel to run",
    value: ocamlCommandName
  })
  if (!ocamlCommand) return;
  ocamlCommandName = ocamlCommand;
}
