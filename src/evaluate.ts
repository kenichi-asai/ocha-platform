import * as vscode from "vscode";
import * as child_process from 'child_process';
import * as path from 'path';

// the build command to run
const buildCommandName = "dune build";

// the path to ocha-platform extension
let extensionPath: string = "";

// called once when the extension is activated
export function activate(context: vscode.ExtensionContext) {
  console.log('"ocha.evaluate" is now active!');

  extensionPath = context.extensionPath;

  // Check if dune is installed
  try {
    child_process.execSync("dune --version");
  } catch (error) {
    vscode.window.showErrorMessage('Error: dune is not installed.');
    return;
  }

  // Check if utop is installed
  try {
    child_process.execSync("utop -version");
  } catch (error) {
    vscode.window.showErrorMessage('Error: utop is not installed.');
    return;
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
  try {
    projectRootDir = child_process.execSync(
      extensionPath + "/scripts/show-root " + projectRootDir).toString().trim();
  } catch (error) {
    vscode.window.showErrorMessage('Error: no dune-project found.');
    return;
  }

  if (terminal) { terminal.dispose(); }
  terminal = vscode.window.createTerminal({
    name: 'ochaterm',
    cwd: projectRootDir
  });
  terminal.show();

  // obtain all the dependent files
  const depFilesPath: string = extensionPath + "/scripts/dependent-files";
  const output =
    child_process.execSync(depFilesPath + " " + editor.document.fileName)
      .toString();
  const files = output.split('\n').filter(line => line.trim() !== '');

  // load the obtained files
  const modUseFilePath: string = extensionPath + "/scripts/mod-use-file";
  await sendText(terminal, modUseFilePath + " " + files.join(' '));
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

  // check if the file to be executed is in the dune project
  try {
    projectRootDir = child_process.execSync(
      extensionPath + "/scripts/show-root " + projectRootDir).toString().trim();
  } catch (error) {
    vscode.window.showErrorMessage('Error: no dune-project found.');
    return;
  }

  if (terminal) { terminal.dispose(); }
  terminal = vscode.window.createTerminal({
    name: 'ochaterm',
    cwd: projectRootDir
  });
  terminal.show();

  await sendText(terminal, buildCommandName);
}
