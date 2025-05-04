import * as vscode from "vscode";
import * as child_process from 'child_process';
import * as path from 'path';

// the OCaml command to run
let ocamlCommandName: string = "";

// whether dune is installed
let duneInstalled: boolean = false;

// whether utop is installed
let utopInstalled: boolean = false;

// the path to ocha-platform extension
let extensionPath: string = "";

// called once when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  console.log('"ocha.evaluate" is now active!');

  extensionPath = context.extensionPath;

  // Determine the OCaml command to run
  try {
    child_process.execSync("utop -version");
    utopInstalled = true;
    try {
      child_process.execSync("dune --version");
      duneInstalled = true;
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
    "Ocha.evaluateBuffer", () => { evaluateBuffer(); }
  );
  context.subscriptions.push(evaluateBufferCommand);

  const buildCommand = vscode.commands.registerCommand(
    "Ocha.build", () => { build(); }
  );
  context.subscriptions.push(buildCommand);

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
export async function evaluateBuffer() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (editor.document.isDirty) {
    const result = await editor.document.save();
    if (!result) return;
  }

  let projectRootDir = path.dirname(editor.document.uri.fsPath);

  // check if the file to be executed is in the dune project
  if (utopInstalled && duneInstalled) {
    try {
      projectRootDir = child_process.execSync(
        extensionPath + "/scripts/show-root " + projectRootDir).toString().trim();
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

  const useFilePath: string = extensionPath + "/scripts/use-file";

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

// called when "Ocha.build" is executed
async function build() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (editor.document.isDirty) {
    const result = await editor.document.save();
    if (!result) return;
  }

  let projectRootDir = path.dirname(editor.document.uri.fsPath);
  let buildCommandName = "make"

  // check if the file to be executed is in the dune project
  if (duneInstalled) {
    try {
      projectRootDir = child_process.execSync(
        extensionPath +
        "/scripts/show-root " + projectRootDir).toString().trim();
      buildCommandName = "dune build";
    } catch (error) {
      buildCommandName = "make";
    }
  }

  if (terminal) { terminal.dispose(); }
  terminal = vscode.window.createTerminal({
    name: 'ochaterm',
    cwd: projectRootDir
  });
  terminal.show();

  await sendText(terminal, buildCommandName);
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
